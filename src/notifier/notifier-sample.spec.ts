import { Notifier } from './notifier';
import { ActionSubscription } from '../helpers/notification-handler';

/**
 * Scenario: I want to notify the listeners about "Sidebar is now opened or closed".
 */

/**
 * Assume that this is a separate file
 * Note: having notifier as a constant in a separete file is suggested
 * so listeners would not need to access SidebarService thus coupling will be reduced
 */
const SidebarNotifier = new Notifier<boolean>({ notifyOnlyOnChange: true });

/**
 * Assume that this is a separate file
 */
class SidebarService {
  open() {
    // some operations to open sidebar
    SidebarNotifier.trigger(true);
  }

  close() {
    // some operations to close sidebar
    SidebarNotifier.trigger(false);
  }
}

/**
 * Assume that this is a separate file
 */
class SomeComponentNeedsToKnowSidebar {
  sidebarIsOpen: boolean = false;
  private sidebarSubscription: ActionSubscription;

  constructor() {
    this.sidebarSubscription = SidebarNotifier.subscribe(isOpen => {
      // in here i will be informed every time sidebar changes its state
      this.sidebarIsOpen = !!isOpen;
    });
  }

  destructor() {
    // don't forget to unsubscribe on destruction
    this.sidebarSubscription.unsubscribe();
  }
}

describe(`Notifier Sample Scenario`, () => {
  it('notify everyone about sidebar open-close events', () => {
    let sidebarService = new SidebarService();
    let headerComponent = new SomeComponentNeedsToKnowSidebar();
    let baseLayout = new SomeComponentNeedsToKnowSidebar();

    sidebarService.open();
    expect(headerComponent.sidebarIsOpen).toEqual(true);
    expect(baseLayout.sidebarIsOpen).toEqual(true);

    sidebarService.close();
    expect(headerComponent.sidebarIsOpen).toEqual(false);
    expect(baseLayout.sidebarIsOpen).toEqual(false);
  });
});
