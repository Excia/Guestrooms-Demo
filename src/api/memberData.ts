// Mock guest directory. PLACEHOLDER until the Member Directory ticket: 25 deterministic people,
// plus the ones added during the session. Replaced by the backend later.
import type { CreateMemberRequest, Member, MemberQuery, Page } from './types';

const NAMES = [
  'Margaret Ellison',
  'Daniel Whitfield',
  'Annika Lindqvist',
  'Olivia Hartman',
  'Grace Nakamura',
  'Victor Almeida',
  'Beatrice Quinn',
  'Lucia Fernandez',
  'Ibrahim Haddad',
  'Hannah Goldberg',
  'Wesley Tran',
  'Samuel Adeyemi',
  'Naomi Castellano',
  'Peter Vandenberg',
  'Claire Beaumont',
  'Henry Lowell',
  'Priya Raman',
  'Sofia Marchetti',
  'Thomas Okafor',
  'Elise Moreau',
  'Marcus Feldman',
  'Julian Brandt',
  'Leonard Pruitt',
  'Robert Cho',
  'Elaine Cho',
];

export function seedMembers(): Member[] {
  return NAMES.map((name, i) => {
    const n = i + 1;
    const [first, last] = name.toLowerCase().split(' ');
    return {
      id: `mem-${n}`,
      memberNumber: `MEM-${String(n).padStart(4, '0')}`,
      name,
      email: `${first}.${last}@example.com`,
      phone: `555-01${String(n).padStart(2, '0')}`,
    };
  });
}

export const DEFAULT_MEMBER_LIMIT = 8;

export function searchMembers(all: readonly Member[], query: MemberQuery = {}): Page<Member> {
  const q = (query.q ?? '').trim().toLowerCase();
  const matches = all
    .filter(
      (m) =>
        q === '' ||
        m.name.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const limit = Math.min(query.limit ?? DEFAULT_MEMBER_LIMIT, 50);
  return { items: matches.slice(0, limit), total: matches.length };
}

export function addMember(all: Member[], request: CreateMemberRequest): Member {
  const member: Member = {
    id: `mem-new-${all.length + 1}`,
    memberNumber: `MEM-${String(9000 + all.length + 1)}`,
    name: request.name.trim(),
    email: request.email?.trim() ?? '',
    phone: request.phone?.trim() ?? '',
  };
  all.push(member);
  return member;
}
