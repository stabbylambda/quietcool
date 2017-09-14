const coap = require("coap");
const _ = require("lodash");
const Rx = require("rxjs");
const RateLimiter = require("limiter").RateLimiter;
var limiter = new RateLimiter(1, 100);

const sendWithRateLimit = req => limiter.removeTokens(1, () => req.end());

const request = (reqOptions, body) => {
  let req = coap.request(reqOptions);

  if (body) {
    req.write(Buffer.from(JSON.stringify(body)));
  }

  sendWithRateLimit(req);

  return Rx.Observable.create(observer => {
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
};

const requestWithId = (id, reqOptions, body) =>
  request(reqOptions, body).map(throwIfNotTheRightFan(id));

const throwIfNotTheRightFan = expected => fan => {
  if (fan.uid !== expected) {
    throw new Error("Stupid controller gave back the wrong fan");
  }
  return fan;
};

const listFansWithInfo = ip => {
  return listFans(ip).flatMap(fans => {
    return Rx.Observable
      .from(fans)
      .concatMap(fan => Rx.Observable.of(fan))
      .flatMap(fan => getFanInfo(ip, fan.uid));
  });
};

// The fan speed selection has three values in the app: 1, 2, and 3
// And those speeds correspond to 4, 1, and 0
// who knows why these values were chosen?!
const sequences = { 3: 0, 2: 1, 1: 4 };

const listFans = ip => request(`coap://${ip}/uids`);

const getFanInfo = (ip, id) => requestWithId(id, `coap://${ip}/device/${id}`);

const getFanStatus = (ip, id) =>
  requestWithId(id, `coap://${ip}/control/${id}`);

const getFanWifi = (ip, id) => requestWithId(id, `coap://${ip}/wifi/${id}`);

const getFanDiagnostics = (ip, id) =>
  requestWithId(id, `coap://${ip}/diagnostic/${id}`);

const updateFanName = (ip, id, name) =>
  requestWithId(
    id,
    { method: "PUT", hostname: ip, pathname: `/device/${id}` },
    { name }
  );

const setTimeRemaining = (ip, id, remaining) =>
  requestWithId(
    id,
    { method: "PUT", hostname: ip, pathname: `/control/${id}` },
    { remaining }
  );

const setCurrentSpeed = (ip, id, speed) =>
  requestWithId(
    id,
    { method: "PUT", hostname: ip, pathname: `/control/${id}` },
    { speed }
  );

const updateFanSpeeds = (ip, id, speeds) =>
  requestWithId(
    id,
    { hostname: ip, pathname: `/control/${id}`, method: "PUT" },
    { sequence: sequences[speeds] }
  );

const turnFanOff = (ip, id) => setTimeRemaining(ip, id, 0);

const turnFanOn = (ip, id) => setTimeRemaining(ip, id, 65535);

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
