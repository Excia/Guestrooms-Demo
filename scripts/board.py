#!/usr/bin/env python3
"""Board helper for the Guestrooms project (GitHub Projects v2, Excia/projects/1).

Used by the Manager agent. Every mutation validates first, then changes the board, and
retries on GitHub rate limits. `--dry-run` may appear anywhere and prints what would change.

  scripts/board.py ready                      list Ready tickets in pick order; skipped ones show why
  scripts/board.py next                       print the single next ticket to work on
  scripts/board.py show N                     print ticket N (body included)
  scripts/board.py claim N [branch]           Ready -> In Progress, label agent:working, comment
  scripts/board.py release N ["reason"]       undo a claim: drop agent:working, back to Ready
  scripts/board.py status N "In Review"       move a ticket to a status
  scripts/board.py block N "reason"           label blocked, comment, drop agent:working, back to Backlog
  scripts/board.py comment N "text"           comment on a ticket
  scripts/board.py done N                     move to Done, drop agent:working and blocked
"""
import json, re, subprocess, sys, time

REPO, PROJECT_ID = 'Excia/Guestrooms-Demo', 'PVT_kwHOAVwAss4BmfKH'
STATUSES = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done']
# Pick order by epic number (see CONTRIBUTING.md and docs/MANAGER.md).
EPIC_ORDER = [0, 1, 3, 4, 2, 8, 7, 6, 5, 9, 10, 11]
DRY = False


def die(msg):
    raise SystemExit('board.py: ' + msg)


def sh(args, tries=6, wait=20, ok_missing=False):
    for i in range(tries):
        r = subprocess.run(args, capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout
        err = (r.stderr + r.stdout)
        if ok_missing and ('404' in err or 'Not Found' in err):
            return ''
        if 'rate limit' not in err.lower() or i == tries - 1:
            die('gh failed: ' + ' '.join(args[:6]) + '\n' + err[:400])
        time.sleep(wait * (i + 1))


def gql(query):
    return json.loads(sh(['gh', 'api', 'graphql', '-f', f'query={query}']))['data']


def parse_number(text):
    m = re.fullmatch(r'#?(\d+)', str(text).strip())
    if not m:
        die(f'"{text}" is not an issue number')
    return int(m.group(1))


FIELDS = '''
  status: fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}
  epic: fieldValueByName(name:"Epic"){... on ProjectV2ItemFieldSingleSelectValue{name}}
  size: fieldValueByName(name:"Size"){... on ProjectV2ItemFieldSingleSelectValue{name}}
  figma: fieldValueByName(name:"Figma page"){... on ProjectV2ItemFieldTextValue{text}}
  deps: fieldValueByName(name:"Depends on"){... on ProjectV2ItemFieldTextValue{text}}
'''


def parse_deps(text):
    """'Depends on' holds issue numbers like '6' or '#6, #7'. Anything else is flagged, not guessed."""
    text = (text or '').strip()
    if not text:
        return [], False
    if not re.fullmatch(r'[#\d,\s]+', text):
        return [], True
    return [int(x) for x in re.findall(r'\d+', text)], False


def load_items():
    items, cursor = [], None
    while True:
        after = f', after:"{cursor}"' if cursor else ''
        d = gql('{node(id:"%s"){... on ProjectV2{items(first:100%s){pageInfo{hasNextPage endCursor} nodes{id %s '
                'content{... on Issue{number title state repository{nameWithOwner} labels(first:30){nodes{name}}}}}}}}}'
                % (PROJECT_ID, after, FIELDS))
        page = d['node']['items']
        for n in page['nodes']:
            c = n['content']
            if not c or c['repository']['nameWithOwner'] != REPO:
                continue
            deps, bad = parse_deps((n['deps'] or {}).get('text'))
            items.append({
                'item': n['id'], 'number': c['number'], 'title': c['title'], 'state': c['state'],
                'labels': [l['name'] for l in c['labels']['nodes']],
                'status': (n['status'] or {}).get('name'), 'epic': (n['epic'] or {}).get('name'),
                'size': (n['size'] or {}).get('name'), 'figma': (n['figma'] or {}).get('text'),
                'deps': deps, 'deps_bad': bad,
            })
        if not page['pageInfo']['hasNextPage']:
            return items
        cursor = page['pageInfo']['endCursor']


def epic_rank(item):
    try:
        return EPIC_ORDER.index(int((item['epic'] or '99').split()[0]))
    except ValueError:
        return 99


def skip_reasons(item, by_num):
    why = []
    if item['state'] != 'OPEN':
        why.append('closed')
    if 'blocked' in item['labels']:
        why.append('labeled blocked')
    if 'agent:working' in item['labels']:
        why.append('agent already working')
    if item['deps_bad']:
        why.append('unreadable "Depends on" (use issue numbers like #6, #7)')
    for d in item['deps']:
        dep = by_num.get(d)
        if not dep or dep['status'] != 'Done':
            why.append(f'waiting on #{d}')
    return why


def ready_queue(items):
    by_num = {i['number']: i for i in items}
    out = []
    for i in sorted((x for x in items if x['status'] == 'Ready' and 'epic' not in x['labels']),
                    key=lambda x: (epic_rank(x), x['number'])):
        i['skip'] = skip_reasons(i, by_num)
        out.append(i)
    return out


def find_item(number, items=None):
    for i in (items or load_items()):
        if i['number'] == number:
            return i
    die(f'#{number} is not on the board')


def status_option(name):
    f = gql('{node(id:"%s"){... on ProjectV2{field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}'
            % PROJECT_ID)['node']['field']
    if not f:
        die('the board has no "Status" field')
    opt = next((o['id'] for o in f['options'] if o['name'] == name), None)
    if not opt:
        die(f'the Status field has no "{name}" option')
    return f['id'], opt


def set_status(item, name):
    if name not in STATUSES:
        die(f'status must be one of {STATUSES}')
    if DRY:
        print(f'[dry-run] #{item["number"]}: {item["status"]} -> {name}')
        return
    fid, oid = status_option(name)
    gql('mutation{updateProjectV2ItemFieldValue(input:{projectId:"%s",itemId:"%s",fieldId:"%s",value:{singleSelectOptionId:"%s"}}){projectV2Item{id}}}'
        % (PROJECT_ID, item['item'], fid, oid))
    print(f'#{item["number"]}: {item["status"]} -> {name}')


def add_label(number, name):
    if DRY:
        print(f'[dry-run] #{number}: add label {name}')
        return
    sh(['gh', 'api', '-X', 'POST', f'repos/{REPO}/issues/{number}/labels', '-f', f'labels[]={name}'])


def remove_label(number, name):
    if DRY:
        print(f'[dry-run] #{number}: remove label {name}')
        return
    sh(['gh', 'api', '-X', 'DELETE', f'repos/{REPO}/issues/{number}/labels/{name}'], ok_missing=True)


def comment(number, text):
    if DRY:
        print(f'[dry-run] #{number}: comment: {text}')
        return
    sh(['gh', 'api', f'repos/{REPO}/issues/{number}/comments', '-f', f'body={text}'])


def main(argv):
    global DRY
    if '--dry-run' in argv:
        DRY = True
        argv = [a for a in argv if a != '--dry-run']
    if not argv:
        print(__doc__); return
    cmd, args = argv[0], argv[1:]

    def need(n, usage):
        if len(args) < n:
            die('usage: ' + usage)

    if cmd in ('ready', 'next'):
        q = ready_queue(load_items())
        if cmd == 'next':
            pick = next((i for i in q if not i['skip']), None)
            print(json.dumps(pick, indent=2) if pick else 'No unblocked Ready tickets.')
            return
        for i in q:
            flag = f"  SKIP ({'; '.join(i['skip'])})" if i['skip'] else ''
            print(f"#{i['number']:<4} {i['size'] or '-':<2} {i['epic'] or '-':<22} {i['title'][:60]}{flag}")
        print(f"\n{sum(1 for i in q if not i['skip'])} pickable, {sum(1 for i in q if i['skip'])} skipped, {len(q)} Ready")
    elif cmd == 'show':
        need(1, 'show N')
        print(sh(['gh', 'issue', 'view', str(parse_number(args[0])), '-R', REPO, '--json', 'number,title,body,labels', '--template',
                  '#{{.number}} {{.title}}\n{{range .labels}}[{{.name}}] {{end}}\n\n{{.body}}\n']))
    elif cmd == 'claim':
        need(1, 'claim N [branch]')
        n = parse_number(args[0])
        items = load_items()
        item = find_item(n, items)
        if item['status'] != 'Ready':
            die(f'#{n} is {item["status"]}, not Ready; only Ready tickets can be claimed')
        why = skip_reasons(item, {i['number']: i for i in items})
        if why:
            die(f'#{n} cannot be claimed: ' + '; '.join(why))
        add_label(n, 'agent:working')
        try:
            set_status(item, 'In Progress')
        except SystemExit:
            remove_label(n, 'agent:working')
            raise
        branch = f' Branch: `{args[1]}`.' if len(args) > 1 else ''
        comment(n, f'Manager agent picked this ticket up.{branch} A PR will follow; a human merges it.')
    elif cmd == 'release':
        need(1, 'release N ["reason"]')
        n = parse_number(args[0])
        item = find_item(n)
        remove_label(n, 'agent:working')
        if item['status'] == 'In Progress':
            set_status(item, 'Ready')
        comment(n, 'Manager agent released this ticket.' + (f' Reason: {args[1]}' if len(args) > 1 else ''))
    elif cmd == 'status':
        need(2, 'status N "<status>"')
        set_status(find_item(parse_number(args[0])), args[1])
    elif cmd == 'block':
        need(2, 'block N "reason"  (a reason is required)')
        n = parse_number(args[0])
        item = find_item(n)
        add_label(n, 'blocked')
        remove_label(n, 'agent:working')
        comment(n, f'Blocked: {args[1]}')
        set_status(item, 'Backlog')
    elif cmd == 'comment':
        need(2, 'comment N "text"')
        n = parse_number(args[0]); find_item(n)
        comment(n, args[1])
    elif cmd == 'done':
        need(1, 'done N')
        n = parse_number(args[0])
        item = find_item(n)
        set_status(item, 'Done')
        remove_label(n, 'agent:working')
        remove_label(n, 'blocked')
    else:
        print(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
