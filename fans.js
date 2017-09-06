const coap = require("coap");
const _ = require("lodash");
const Rx = require("rxjs");

const requestToObservable = req => {
  let response$ = Rx.Observable.fromEvent(req, "response").map(res => {
    if (!res.code.includes("2.")) {
      throw new Error(res);
    }

    return JSON.parse(res.payload.toString());
  });

  let error$ = Rx.Observable
    .fromEvent(req, "error")
    .flatMap(err => Rx.Observable.throw(err));
  let timeout$ = Rx.Observable
    .fromEvent(req, "timeout")
    .flatMap(err => Rx.Observable.throw(err));

  return Rx.Observable.merge(response$, error$, timeout$);
};

const listFans = ip => {
  let response$ = requestToObservable(coap.request(`coap://${ip}/uids`).end());
  return response$;
};

const throwIfNotTheRightFan = expected => fan => {
  if (fan.uid !== expected) {
    throw new Error("Stupid controller gave back the wrong fan");
  }

  return fan;
};

const getFanInfo = (ip, id) => {
  let response$ = requestToObservable(
    coap.request(`coap://${ip}/device/${id}`).end()
  );

  return response$.map(throwIfNotTheRightFan(id));
};

const getFanStatus = (ip, id) => {
  let response$ = requestToObservable(
    coap.request(`coap://${ip}/control/${id}`).end()
  );
  return response$.map(throwIfNotTheRightFan(id));
};

const getFanWifi = (ip, id) => {
  let response$ = requestToObservable(
    coap.request(`coap://${ip}/wifi/${id}`).end()
  );
  return response$.map(throwIfNotTheRightFan(id));
};

const getFanDiagnostics = (ip, id) => {
  let response$ = requestToObservable(
    coap.request(`coap://${ip}/diagnostic/${id}`).end()
  );
  return response$.map(throwIfNotTheRightFan(id));
};

const updateFanName = (ip, id, name) => {
  let updateRequest = coap.request({
    hostname: ip,
    pathname: `/device/${id}`,
    method: "PUT"
  });

  updateRequest.write(
    Buffer.from(
      JSON.stringify({
        name
      })
    )
  );

  let response$ = requestToObservable(updateRequest.end());

  return response$.map(throwIfNotTheRightFan(id));
};

const updateFanSpeeds = (ip, id, speeds) => {
  // The fan speed selection has three values in the app: 1, 2, and 3
  // And those speeds correspond to 4, 1, and 0
  // who knows why these values were chosen?!

  const sequences = {
    3: 0,
    2: 1,
    1: 4
  };

  let sequence = sequences[speeds];
  let updateRequest = coap.request({
    hostname: ip,
    pathname: `/control/${id}`,
    method: "PUT"
  });

  updateRequest.write(
    Buffer.from(
      JSON.stringify({
        sequence
      })
    )
  );

  let response$ = requestToObservable(updateRequest.end());

  return response$.map(throwIfNotTheRightFan(id));
};

const setTimeRemaining = (ip, id, remaining) => {
  let updateRequest = coap.request({
    hostname: ip,
    pathname: `/control/${id}`,
    method: "PUT"
  });

  updateRequest.write(Buffer.from(JSON.stringify({ remaining })));

  let response$ = requestToObservable(updateRequest.end());

  return response$.map(throwIfNotTheRightFan(id));
};

const setCurrentSpeed = (ip, id, speed) => {
  let updateRequest = coap.request({
    hostname: ip,
    pathname: `/control/${id}`,
    method: "PUT"
  });

  updateRequest.write(Buffer.from(JSON.stringify({ speed })));

  let response$ = requestToObservable(updateRequest.end());

  return response$.map(throwIfNotTheRightFan(id));
};

const turnFanOff = (ip, id) => setTimeRemaining(ip, id, 0);
const turnFanOn = (ip, id) => setTimeRemaining(ip, id, 65535);

module.exports = {
  listFans,
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
