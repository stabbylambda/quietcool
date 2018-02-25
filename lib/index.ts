import { Observable } from "rxjs";
import {
  FanId,
  UidOnly,
  FanDetails,
  DeviceResponse,
  ControlResponse,
  request,
  requestWithId,
  putRequestWithId
} from "./request";

export const getFanDetails = (id: FanId): Observable<FanDetails> =>
  Observable.zip(getFanInfo(id), getFanStatus(id), (info, status) => ({
    id,
    info,
    status
  }));

export const listFansWithInfo = (ip: string) =>
  listFans(ip)
    .flatMap(fans => Observable.from(fans))
    .flatMap(getFanDetails);

// The fan speed selection has three values in the app: 1, 2, and 3
// And those speeds correspond to 4, 1, and 0
// who knows why these values were chosen?!

export const listFans = (ip: string): Observable<FanId[]> =>
  request<UidOnly[]>(`coap://${ip}/uids`).map(x =>
    x.map(y => ({ uid: y.uid, ip }))
  );

export const getFanInfo = (id: FanId): Observable<DeviceResponse> =>
  requestWithId(id, `coap://${id.ip}/device/${id.uid}`);

export const getFanStatus = (id: FanId): Observable<ControlResponse> =>
  requestWithId(id, `coap://${id.ip}/control/${id.uid}`);

export const getFanWifi = (id: FanId) =>
  requestWithId(id, `coap://${id.ip}/wifi/${id.uid}`);

export const getFanDiagnostics = (id: FanId) =>
  requestWithId(id, `coap://${id.ip}/diagnostic/${id.uid}`);

export const updateFanName = (
  id: FanId,
  name: string
): Observable<DeviceResponse> =>
  putRequestWithId(id, `/device/${id.uid}`, { name });

export const setTimeRemaining = (
  id: FanId,
  remaining: number
): Observable<ControlResponse> =>
  putRequestWithId(id, `/control/${id.uid}`, { remaining });

export const setCurrentSpeed = (
  id: FanId,
  speed: string
): Observable<ControlResponse> =>
  putRequestWithId(id, `/control/${id.uid}`, { speed });

const sequences = { "3": 0, "2": 1, "1": 4 };
export const updateFanSpeeds = (
  id: FanId,
  speeds: string
): Observable<ControlResponse> =>
  putRequestWithId(id, `/control/${id.uid}`, {
    sequence: sequences[speeds]
  });

export const turnFanOff = (id: FanId) => setTimeRemaining(id, 0);

export const turnFanOn = (id: FanId) => setTimeRemaining(id, 65535);
