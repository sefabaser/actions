import { NotificationHandler } from './notification-handler';

describe(`Notification Handler`, () => {
  let notifier: NotificationHandler<string>;

  beforeEach(() => {
    notifier = new NotificationHandler<string>();
  });

  it('should be definable', () => {
    expect(notifier).toBeDefined();
  });

  it('should be subscribable', () => {
    notifier.subscribe(message => { });
    expect(notifier['listenersMap'].size).toEqual(1);
  });

  it('should be unsubscribable', () => {
    let subscription = notifier.subscribe(message => { });
    subscription.unsubscribe();
    expect(notifier['listenersMap'].size).toEqual(0);
  });

  it('should iterate without listeners', done => {
    notifier.forEach(() => {});
    done();
  });

  it('should iterate through listeners', () => {
    notifier.subscribe(() => {});
    notifier.subscribe(() => {});

    let count = 0;
    notifier.forEach(listenerCallback => {
      count++;
    });

    expect(count).toEqual(2);
  });

  it('should notify listeners', done => {
    let listener1 = false;
    let listener2 = false;

    notifier.subscribe(message => {
      if (message === 'sample') {
        listener1 = true;
        if (listener2) {
          done();
        }
      }
    });

    notifier.subscribe(message => {
      if (message === 'sample') {
        listener2 = true;
        if (listener1) {
          done();
        }
      }
    });

    notifier.forEach(listenerCallback => {
      listenerCallback('sample');
    });
  });
});
