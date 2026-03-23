import { images } from './images';

export interface Coach {
  id: number;
  name: string;
  title: string;
  handle: string;
  slug: string;
  status: string;
  avatarUrl: string;
}

export const coaches: Coach[] = [
  {
    id: 1,
    name: 'Paul Torres',
    title: 'Director & Head Coach',
    handle: 'coach1',
    slug: 'paul-torres',
    status: 'Available',
    avatarUrl: images.coach1,
  },
  {
    id: 2,
    name: 'Phillip Gyau',
    title: 'Head Coach',
    handle: 'coach2',
    slug: 'phillip-gyau',
    status: 'Available',
    avatarUrl: images.coach2,
  },
  {
    id: 3,
    name: 'Ryan Machado',
    title: 'Pro Coach',
    handle: 'coach3',
    slug: 'ryan-machado',
    status: 'Available',
    avatarUrl: images.coach3,
  },
  {
    id: 4,
    name: 'Gonzalo Carrasco',
    title: 'Pro Coach',
    handle: 'coach4',
    slug: 'gonzalo-carrasco',
    status: 'Available',
    avatarUrl: images.coach4,
  },
  {
    id: 5,
    name: 'Steve Birnbaum',
    title: 'Pro Coach',
    handle: 'coach5',
    slug: 'steve-birnbaum',
    status: 'Available',
    avatarUrl: images.coach5,
  },
  {
    id: 6,
    name: 'Marco Etcheverry',
    title: 'Pro Coach',
    handle: 'coach6',
    slug: 'marco-etcheverry',
    status: 'Available',
    avatarUrl: images.coach6,
  },
  {
    id: 7,
    name: 'Patrick Mullins',
    title: 'Pro Coach',
    handle: 'coach7',
    slug: 'patrick-mullins',
    status: 'Available',
    avatarUrl: images.coach7,
  },
  {
    id: 8,
    name: 'Chris Pontius',
    title: 'Pro Coach',
    handle: 'coach8',
    slug: 'chris-pontius',
    status: 'Available',
    avatarUrl: images.coach8,
  },
];
