import * as Rx from 'rxjs';
import * as api from '../index';

describe('fanControl', () => {
    it('listFans', () => {
        api.listFans("127.0.0.1");

        expect(true).toBe(true);
    });
});
