#!/usr/bin/env python3
"""Board helper for the Guestrooms project (GitHub Projects v2, Excia/projects/1).

Used by the Manager agent. Reads are cheap; every mutation retries on GitHub rate
limits. Pass --dry-run before the subcommand to print what would change.

  scripts/board.py ready                 list Ready tickets in pick order, with blocked ones flagged
  scripts/board.py next                  print the single next ticket to work on
  scripts/board.py show N                print ticket N (body included)
  scripts/board.py claim N               Ready -> In Progress, label agent:working, comment
  scripts/board.py status N "In Review"  move a ticket to a status
  scripts/board.py block N "reason"      label blocked, comment the reason, move back to Backlog
  scripts/board.py comment N "text"      comment on a ticket
  scripts/board.py done N                move to Done and drop agent:working
"""
import json, subprocess, sys, time

OWNER, REPO, PROJECT_ID = 'Excia', 'Excia/Guestrooms-Demo', 'PVT_kwHOAVwAss4BmfKH'
STATUSES = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done']
# Pick order by epic number (see CONTRIBUTING.md and docs/MANAGER.md).
EPIC_ORDER = [0, 1, 3, 4, 2, 8, 7, 6, 5, 9, 10, 11]
DRY = False


def sh(args, tries=6, wait=20):
    for i in range(tries):
        r = subprocess.run(args, capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout
        if 'rate limit' not in (r.stderr + r.stdout).lower() or i == tries - 1:
            raise SystemExit('gh failed: ' + ' '.join(args[:6]) + '\n' + (r.stderr or r.stdout)[:400])
        time.sleep(wait * (i + 1))


def gql(query):
    return json.loads(sh(['gh', 'api', 'graphql', '-f', f'query={query}']))['data']


FIELDS = '''
  status: fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}
  epic: fieldValueByName(name:"Epic"){... on ProjectV2ItemFieldSingleSelectValue{name}}
  size: fieldValueByName(name:"Size"){... on ProjectV2ItemFieldSingleSelectValue{name}}
  figma: fieldValueByName(name:"Figma page"){... on ProjectV2ItemFieldTextValue{text}}
  deps: fieldValueByName(name:"Depends on"){... on ProjectV2ItemFieldTextValue{text}}
'''


def load_items():
    items, cursor = [], None
    while True:
        after = f', after:"{cursor}"' if cursor else ''
        d = gql('{node(id:"%s"){... on ProjectV2{items(first:100%s){pageInfo{hasNextPage endCursor} nodes{id %s '
                'content{... on Issue{number title state labels(first:12){nodes{name}}}}}}}}}' % (PROJECT_ID, after, FIELDS))
        page = d['node']['items']
        for n in page['nodes']:
            c = n['content']
            if not c:
                continue
            items.append({
                'item': n['id'], 'number': c['number'], 'title': c['title'], 'state': c['state'],
                'labels': [l['name'] for l in c['labels']['nodes']],
                'status': (n['status'] or {}).get('name'), 'epic': (n['epic'] or {}).get('name'),
                'size': (n['size'] or {}).get('name'), 'figma': (n['figma'] or {}).get('text'),
                'deps': [int(x) for x in ''.join(c if c.isdigit() else ' ' for c in ((n['deps'] or {}).get('text') or '')).split()],
            })
        if not page['pageInfo']['hasNextPage']:
            return items
        cursor = page['pageInfo']['endCursor']


def epic_rank(item):
    try:
        return EPIC_ORDER.index(int((item['epic'] or '99').split()[0]))
    except ValueError:
        return 99


def ready_queue(items):
    by_num = {i['number']: i for i in items}
    out = []
    for i in sorted((x for x in items if x['status'] == 'Ready' and 'epic' not in x['labels']),
                    key=lambda x: (epic_rank(x), x['number'])):
        why = []
        if 'blocked' in i['labels']:
            why.append('labeled blocked')
        if 'agent:working' in i['labels']:
            why.append('agent already working')
        for d in i['deps']:
            dep = by_num.get(d)
            if not dep or dep['status'] != 'Done':
                why.append(f'waiting on #{d}')
        i['skip'] = why
        out.append(i)
    return out


def status_option(name):
    d = gql('{node(id:"%s"){... on ProjectV2{field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}' % PROJECT_ID)
    f = d['node']['field']
    return f['id'], next(o['id'] for o in f['options'] if o['name'] == name)


def set_status(number, name):
    if name not in STATUSES:
        raise SystemExit(f'status must be one of {STATUSES}')
    item = next(i for i in load_items() if i['number'] == number)
    if DRY:
        print(f'[dry-run] #{number}: {item["status"]} -> {name}')
        return
    fid, oid = status_option(name)
    gql('mutation{updateProjectV2ItemFieldValue(input:{projectId:"%s",itemId:"%s",fieldId:"%s",value:{singleSelectOptionId:"%s"}}){projectV2Item{id}}}'
        % (PROJECT_ID, item['item'], fid, oid))
    print(f'#{number}: {item["status"]} -> {name}')


def label(number, add=None, remove=None):
    if DRY:
        print(f'[dry-run] #{number}: labels +{add} -{remove}')
        return
    if add:
        sh(['gh', 'api', '-X', 'POST', f'repos/{REPO}/issues/{number}/labels', '-f', f'labels[]={add}'])
    if remove:
        subprocess.run(['gh', 'api', '-X', 'DELETE', f'repos/{REPO}/issues/{number}/labels/{remove}'], capture_output=True)


def comment(number, text):
    if DRY:
        print(f'[dry-run] #{number}: comment: {text}')
        return
    sh(['gh', 'api', f'repos/{REPO}/issues/{number}/comments', '-f', f'body={text}'])


def main(argv):
    global DRY
    if argv and argv[0] == '--dry-run':
        DRY, argv = True, argv[1:]
    if not argv:
        print(__doc__); return
    cmd, args = argv[0], argv[1:]
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
        print(sh(['gh', 'issue', 'view', args[0], '-R', REPO, '--json', 'number,title,body,labels', '--template',
                  '#{{.number}} {{.title}}\n{{range .labels}}[{{.name}}] {{end}}\n\n{{.body}}\n']))
    elif cmd == 'claim':
        n = int(args[0]); set_status(n, 'In Progress'); label(n, add='agent:working')
        comment(n, 'Manager agent picked this ticket up. A specialist is working on it in a branch; a PR will follow.')
    elif cmd == 'status':
        set_status(int(args[0]), args[1])
    elif cmd == 'block':
        n = int(args[0]); label(n, add='blocked', remove='agent:working'); comment(n, f'Blocked: {args[1]}'); set_status(n, 'Backlog')
    elif cmd == 'comment':
        comment(int(args[0]), args[1])
    elif cmd == 'done':
        n = int(args[0]); set_status(n, 'Done'); label(n, remove='agent:working')
    else:
        print(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
