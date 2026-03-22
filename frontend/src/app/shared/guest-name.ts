const ADJECTIVES = [
  'Swift', 'Bold', 'Calm', 'Brave', 'Keen', 'Dark', 'Wild', 'Sly',
  'Bright', 'Fierce', 'Quick', 'Sharp', 'Cool', 'Wise', 'Proud',
];

const ANIMALS = [
  'Fox', 'Panda', 'Wolf', 'Bear', 'Hawk', 'Lynx', 'Crow', 'Deer',
  'Otter', 'Raven', 'Tiger', 'Viper', 'Eagle', 'Moose', 'Koala',
];

export function generateGuestName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${animal}${num}`;
}
