/**
 * Playable bobas. `tea` is the top→bottom gradient of the drink, `limb` colors arms and legs,
 * `pattern` picks the drawing on the tea texture (see entities/boba.js).
 */
export const BOBAS = [
  {
    name: 'Jasmine Milk Oolong',
    note: 'Floral oolong, softly creamy',
    tea: ['#f7eed3', '#e4d4a4'],
    limb: '#c9b583',
    pattern: 'flower',
  },
  {
    name: 'Lychee Jelly Cube',
    note: 'Bright lychee with clear jelly',
    tea: ['#fbeff1', '#f0cdd6'],
    limb: '#d5a6b1',
    pattern: 'cubes',
  },
  {
    name: 'Peach Silk Milk Tea',
    note: 'White peach folded into milk tea',
    tea: ['#fbe5d6', '#efb495'],
    limb: '#d49478',
    pattern: 'swirl',
  },
  {
    name: 'Smoke Brown Sugar',
    note: 'Torched brown sugar, deep and smoky',
    tea: ['#f3e5d3', '#e4cdb0'],
    limb: '#9c6a45',
    pattern: 'tiger',
    pearl: '#3e1c0c',
  },
  {
    name: 'Matcha Coco',
    note: 'Stone-ground matcha, coconut cream',
    tea: ['#d5e6c0', '#93b47a'],
    limb: '#7f9a6c',
    pattern: 'coco',
  },
  {
    name: 'Roasted Rice Milk Tea',
    note: 'Toasted genmai, nutty and warm',
    tea: ['#eedcbc', '#cfae7f'],
    limb: '#ad8a5e',
    pattern: 'rice',
  },
];
