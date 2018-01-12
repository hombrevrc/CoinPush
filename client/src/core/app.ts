import { MicroEvent } from "./helpers/classes/micro-event.helper";
import { generalHelpers } from './helpers/general';
import { StorageHelper } from "./helpers/classes/storage.helper";
import { getAddress } from './app.address';
import { NotificationHelper } from "./helpers/classes/notification.helper";

export class App extends MicroEvent {

    public platform = window['platform'];
    public address;
    public storage = new StorageHelper();
    public notification = new NotificationHelper();
    public helpers = generalHelpers;

    public user;
    public data: any = {};
    public isReady = false;
    public angularReady = false;
    public angularReady$ = Promise.resolve();

    constructor() {
        super();
    }

    public async init(): Promise<void> {
        this._updateInitialProgressBar(5);

        this.address = getAddress();
        await this._loadStoredUser();

        this._updateInitialProgressBar(10);

        await this._loadData()

        // set initial unread notification badge count
        if (this.data.notifications)
            this.notification.updateBadgeCounter(parseInt(this.data.notifications.unreadCount, 10));

        this.isReady = true;
        this.emit('ready', true);
    }

    // TODO: move to helper class
    public loadAds() {

        // TODO: Desktop ads
        if (!this.platform.isApp)
            return;

        let admobid: { banner?: string, interstitial?: string } = {};

        if (/(android)/i.test(navigator.userAgent)) { // for android & amazon-fireos
            admobid.banner = 'ca-app-pub-1181429338292864/7213864636';
            admobid.interstitial = 'ca-app-pub-1181429338292864/7213864636';
        } else if (/(ipod|iphone|ipad)/i.test(navigator.userAgent)) { // for ios
            admobid.banner = 'ca-app-pub-1181429338292864/7213864636';
            admobid.interstitial = 'ca-app-pub-1181429338292864/7213864636';
        }

        window['AdMob'].createBanner({
            adSize: 'BANNER',
            overlap: true,
            height: 60, // valid when set adSize 'CUSTOM'
            adId: admobid.banner,
            position: window['AdMob'].AD_POSITION.BOTTOM_CENTER,
            autoShow: true,
            isTesting: false
        });

        document.addEventListener('onAdFailLoad', function (error) {
            console.error(error);
        });
    }

    private _loadData(): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', this.address.apiUrl + 'authenticate?profile=true', true);

            // set auth token
            if (this.user)
                xhr.setRequestHeader('Authorization', 'Bearer ' + this.user.token);

            // update progress bar
            xhr.onprogress = event => {
                this._updateInitialProgressBar(((event.loaded / event.total) * 70) + 20);
            };

            // ready
            xhr.onload = () => {
                this.data = JSON.parse(xhr.response);

                if (this.data.user) {
                    this.user = this.data.user;
                    delete this.data.user;
                }

                if (document.readyState === 'complete')
                    return resolve();

                document.addEventListener('DOMContentLoaded', function callback() {
                    document.removeEventListener('DOMContentLoaded', callback, false);
                    resolve();
                }, false);
            }

            xhr.send();
        });
    }

    public async updateStoredUser(user = this.user): Promise<void> {
        this.user = user;
        await this.storage.set('current-user', user);
    }

    public async removeStoredUser(): Promise<void> {
        await this.storage.remove('current-user');
    }

    private async _loadStoredUser(): Promise<any> {
        const user = await this.storage.get('current-user')

        if (user && user.token)
            this.user = user
    }

    public initNotifications(): Promise<void> {
        return this.notification.init();
    }

    private _updateInitialProgressBar(amount) {
        const progressBarEl: any = document.getElementById('initialProgressBar');
        if (progressBarEl) {
            progressBarEl.children[0].innerHTML = amount.toFixed(0) + '%';
            progressBarEl.children[1].style.width = amount + '%';
        }
    }
}

export const app = window['app'] = new App();
app.init().catch(console.error);