const _ = require("lodash");
const Rx = require("rxjs");
const config = require("dotenv").config();

const fanControl = require("./fans");

const Enquirer = require("enquirer");
const enquirer = new Enquirer();
enquirer.register("list", require("prompt-list"));

const formatFanName = ({ info, status }) => {
  const power = { "1": "ON", "0": "OFF" };
  const speeds = { 3: "High", 2: "Medium", 1: "Low" };
  let onOff = power[info.status];
  let currentSpeed = speeds[status.speed];
  return `${info.name} ${onOff} ${currentSpeed} (${info.uid})`;
};

const mainMenu = ip => {
  return Rx.Observable
    .of(ip)
    .flatMap(ip => fanControl.listFans(ip))
    .flatMap(fans => {
      let fanCount = fans.length;
      console.log(`Found ${fanCount} fans`);
      return Rx.Observable
        .from(fans)
        .concatMap(fan => Rx.Observable.of(fan).delay(100))
        .flatMap(fan => fanControl.getFanInfo(ip, fan.uid))
        .flatMap(info =>
          fanControl.getFanStatus(ip, info.uid).map(status => ({
            status,
            info
          }))
        )
        .take(fanCount)
        .reduce((acc, fan) => {
          acc[fan.info.uid] = fan;
          return acc;
        }, {});
    })
    .flatMap(fans => {
      let choices = _.map(fans, formatFanName);

      return enquirer.ask([
        {
          type: "list",
          name: "mainMenu",
          message: "Here are your fans",
          choices: [...choices, enquirer.separator(), "Refresh", "Quit"],
          transform: answer => {
            if (answer == "Refresh" || answer == "Quit") {
              return { type: "action", value: answer };
            }
            let fan = _.find(fans, x => answer === formatFanName(x));
            return { type: "fan", value: fan };
          }
        }
      ]);
    });
};

const speedMenu = (ip, answers) => {
  let uid = answers.mainMenu.value.info.uid;

  return Rx.Observable
    .from(
      enquirer.ask([
        {
          type: "list",
          name: "setSpeed",
          message: `What speed for ${answers.mainMenu.value.info.name}`,
          choices: ["High", "Medium", "Low"]
        }
      ])
    )
    .flatMap(answers => {
      switch (answers.setSpeed) {
        case "High":
          return fanControl.setCurrentSpeed(ip, uid, 3);
        case "Medium":
          return fanControl.setCurrentSpeed(ip, uid, 2);
        case "Low":
          return fanControl.setCurrentSpeed(ip, uid, 1);
      }
    })
    .flatMap(x => program(ip));
};

const program = ip => {
  return mainMenu(ip)
    .takeWhile(answer => answer.mainMenu.value != "Quit")
    .flatMap(({ mainMenu: { type, value } }) => {
      if (type == "action" && value == "Refresh") {
        return program(ip);
      } else {
        return enquirer.ask([
          {
            type: "list",
            name: "action",
            message: "What do you want to do?",
            choices: [
              "Turn On",
              "Turn Off",
              "Set Speed",
              "Update Name",
              "Update Speed",
              "Back To Menu"
            ]
          }
        ]);
      }
    })
    .flatMap(answers => {
      let uid = answers.mainMenu.value.info.uid;
      switch (answers.action) {
        case "Turn On":
          return fanControl.turnFanOn(ip, uid).flatMap(x => program(ip));
        case "Turn Off":
          return fanControl.turnFanOff(ip, uid).flatMap(x => program(ip));
        case "Set Speed":
          return speedMenu(ip, answers);
        case "Back To Menu":
          return program(ip);
        default:
          return program(ip);
      }
    });
};
let ip = process.env.CONTROLLER_IP;
program(ip)
  .catch(err => {
    console.log("ERROR", err);
    program(ip);
  })
  .subscribe(
    fans => console.log(fans),
    err => console.log(err),
    () => console.log("completed")
  );
