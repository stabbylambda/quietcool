import * as coap from "coap";
import { Observable } from "rxjs";
import { RateLimiter } from "limiter";

const limiter = new RateLimiter(1, 100);

const sendWithRateLimit = req => limiter.removeTokens(1, () => req.end());

export interface UidOnly {
  uid: string;
}

export interface FanId extends UidOnly {
  ip: string;
}

export interface RequestOptions {
  method: string;
  hostname: string;
  pathname: string;
}

export interface DeviceResponse extends FanId {
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

export interface ControlResponse extends FanId {
  mode: string;
  sequence: string;
  speed: string;
  duration: string;
  started: string;
  remaining: string;
  source: string;
  input_1_value: string;
}

export interface FanDetails {
  id: FanId;
  info: DeviceResponse;
  status: ControlResponse;
}

export function request<T>(url: string, body?: object): Observable<T>;
export function request<T>(options: object, body?: object): Observable<T>;
export function request<T>(reqOptions, body) {
  return Observable.create(observer => {
    let req = coap.request(reqOptions);

    if (body) {
      req.write(Buffer.from(JSON.stringify(body)));
    }

    sendWithRateLimit(req);
    const errAndComplete = err => {
      observer.error(err);
      observer.complete();
    };

    req.on("response", res => {
      if (!res.code.includes("2.")) {
        return errAndComplete(new Error(res));
      }

      observer.next(JSON.parse(res.payload.toString()));
      observer.complete();
    });

    req.on("error", errAndComplete);
    req.on("timeout", errAndComplete);
  });
}

function throwIfNotTheRightFan(expected: FanId) {
  return function<T extends FanId>(fan: T): T {
    if (fan.uid !== expected.uid) {
      throw new Error("Stupid controller gave back the wrong fan");
    }
    return fan;
  };
}

export function requestWithId<T extends FanId>(
  id: FanId,
  url: string,
  body?: object
): Observable<T>;
export function requestWithId<T extends FanId>(
  id: FanId,
  options: RequestOptions,
  body?: object
): Observable<T>;
export function requestWithId<T extends FanId>(id, reqOptions, body) {
  return request<T>(reqOptions, body).map(throwIfNotTheRightFan(id));
}

export function putRequestWithId<T extends FanId>(
  id: FanId,
  pathname: string,
  data: object
): Observable<T> {
  return requestWithId(id, { method: "PUT", hostname: id.ip, pathname }, data);
}
