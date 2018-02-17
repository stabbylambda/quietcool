import * as coap from "coap";
import { Observable } from "rxjs";
import { RateLimiter } from "limiter";

interface FanId {
  uid: string;
}

interface DeviceResponse {
  uid: string;
  type: string;
  name: string;
  version: string;
  config: string;
  model: string;
  pincode: string;
  role: string;
  online: string;
  status: string;
  hubid: string;
}

interface ControlResponse {
  uid: string;
  mode: string;
  sequence: string;
  speed: string;
  duration: string;
  started: string;
  remaining: string;
  source: string;
  input_1_value: string;
}

var limiter = new RateLimiter(1, 100);

const sendWithRateLimit = req => limiter.removeTokens(1, () => req.end());

function throwIfNotTheRightFan(expected: string) {
  return function(fan: FanId): FanId {
    if (fan.uid !== expected) {
      throw new Error("Stupid controller gave back the wrong fan");
    }
    return fan;
  };
}

function request<T>(url: string, body?: object): Observable<T>;
function request<T>(options: object, body?: object): Observable<T>;
function request<T>(reqOptions, body) {
  let req = coap.request(reqOptions);

  if (body) {
    req.write(Buffer.from(JSON.stringify(body)));
  }

  sendWithRateLimit(req);

  return Observable.create(observer => {
    const errAndComplete = err => {
      observer.error(err);
      observer.complete();
    };

    req.on("response", res => {
      if (!res.code.includes("2.")) {
        errAndComplete(new Error(res));
      }

      observer.next(JSON.parse(res.payload.toString()));
      observer.complete();
    });

    req.on("error", errAndComplete);
    req.on("timeout", errAndComplete);
  });
}

function requestWithId<T extends FanId>(
  id: string,
  url: string,
  body?: object
): Observable<T>;
function requestWithId<T extends FanId>(
  id: string,
  options: object,
  body?: object
): Observable<T>;
function requestWithId<T extends FanId>(id, reqOptions, body) {
  return request<T>(reqOptions, body).map(throwIfNotTheRightFan(id));
}

const listFansWithInfo = ip =>
  listFans(ip)
    .flatMap(fans => Observable.from(fans))
    .flatMap(fan =>
      Observable.zip(
        getFanInfo(ip, fan.uid),
        getFanStatus(ip, fan.uid),
        (info, status) => ({ uid: fan.uid, info, status })
      )
    );

// The fan speed selection has three values in the app: 1, 2, and 3
// And those speeds correspond to 4, 1, and 0
// who knows why these values were chosen?!
const sequences = { 3: 0, 2: 1, 1: 4 };

function listFans(ip: string): Observable<FanId[]> {
  return request(`coap://${ip}/uids`);
}

function getFanInfo(ip: string, id: string): Observable<DeviceResponse> {
  return requestWithId(id, `coap://${ip}/device/${id}`);
}

function getFanStatus(ip: string, id: string): Observable<ControlResponse> {
  return requestWithId(id, `coap://${ip}/control/${id}`);
}

const getFanWifi = (ip: string, id: string) =>
  requestWithId(id, `coap://${ip}/wifi/${id}`);

const getFanDiagnostics = (ip: string, id: string) =>
  requestWithId(id, `coap://${ip}/diagnostic/${id}`);

const updateFanName = (ip: string, id: string, name) =>
  requestWithId(
    id,
    { method: "PUT", hostname: ip, pathname: `/device/${id}` },
    { name }
  );

const setTimeRemaining = (ip: string, id: string, remaining) =>
  requestWithId(
    id,
    { method: "PUT", hostname: ip, pathname: `/control/${id}` },
    { remaining }
  );

const setCurrentSpeed = (ip: string, id: string, speed) =>
  requestWithId(
    id,
    { method: "PUT", hostname: ip, pathname: `/control/${id}` },
    { speed }
  );

const updateFanSpeeds = (ip: string, id: string, speeds) =>
  requestWithId(
    id,
    { hostname: ip, pathname: `/control/${id}`, method: "PUT" },
    { sequence: sequences[speeds] }
  );

const turnFanOff = (ip: string, id: string) => setTimeRemaining(ip, id, 0);

const turnFanOn = (ip: string, id: string) => setTimeRemaining(ip, id, 65535);

module.exports = {
  listFans,
  listFansWithInfo,
  turnFanOn,
  turnFanOff,
  updateFanSpeeds,
  updateFanName,
  getFanInfo,
  getFanStatus,
  getFanWifi,
  getFanDiagnostics,
  setCurrentSpeed
};
