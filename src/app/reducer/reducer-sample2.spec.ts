import { Reducer } from './reducer';

/**
 * Scenario: Lets implement the same scenario from 'Question' with reducer this time.
 * Assume that we are developing a computer game.
 * In this game we have warriors and many different things are effecting their attack power.
 * Lets say we have hundreds of them to effect attack power such as; skills, area effects, spells, auras, etc...
 *
 * So the problem is we don't want to check every single possible effect one by one.
 */

/**
 * Assume that this is a separate file
 */
const areaEffect = Reducer.createSum();

/**
 * Assume that this is a separate file
 */
class Warrior {
  private strength: number;
  private areaEffect: number = 0;

  constructor(strength: number) {
    this.strength = strength;

    areaEffect.subscribe(result => {
      // Lets say we need to update something or actively do some operations, after each area effect change. We can do those here.
      this.areaEffect = result;
    });
  }

  getAttack(): number {
    return this.strength + this.areaEffect;
  }
}

/**
 * Assume that this is a separate file
 * we might have many different warriors whose being affected by area effects
 */
let pikeman = new Warrior(2);
let knight = new Warrior(5);

describe(`Reducer Sample Scenario`, () => {
  it('calculation of attack bonuses', done => {
    // we have a great commander and he has an aura which gives everyone +2 bonus
    areaEffect.effect(2);

    // all warriors are on fort walls which gives everyone +1 bonus
    areaEffect.effect(1);

    // a witch has cursed the area and it gives to everyone -2 for 5 minutes (in this case it is 5 ms to make tests faster :D)
    let curseEffect = areaEffect.effect(-2);

    setTimeout(() => {
      curseEffect.destroy();
    }, 5);

    expect(pikeman.getAttack()).toEqual(3);
    expect(knight.getAttack()).toEqual(6);

    setTimeout(() => {
      // after curse effect
      if (pikeman.getAttack() === 5 && knight.getAttack() === 8) {
        done();
      }
    }, 5);
  });
});
