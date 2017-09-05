const _ = require("lodash");
const Rx = require("rxjs");
const config = require("dotenv").config();

const fanControl = require('./fans');

const Enquirer = require("enquirer");
const enquirer = new Enquirer();
enquirer.register('list', require('prompt-list'));

const formatFanName = ({
    info,
    status
}) => {
    const power = {"1": "ON", "0": "OFF"};
    const speeds = {3: "High", 2: "Medium", 1: "Low"};
    let onOff = power[info.status];
    let currentSpeed = speeds[status.speed];
    return `${info.name} ${onOff} ${currentSpeed} (${info.uid})`;
};

const mainMenu = (ip) => {
return Rx.Observable.of(ip)
    .flatMap(ip => fanControl.listFans(ip))
    .flatMap(fans => {
        let fanCount = fans.length;
        console.log(`Found ${fanCount} fans`);
        return Rx.Observable.from(fans)
            .concatMap(fan => Rx.Observable.of(fan).delay(100))
            .flatMap(fan => fanControl.getFanInfo(ip, fan.uid))
            .flatMap(info => fanControl.getFanStatus(ip, info.uid).map(status => ({
                status,
                info
            })))
            .take(fanCount)
            .reduce((acc, fan) => {
                acc[fan.info.uid] = fan;
                return acc;
            }, {});
    })
    .flatMap(fans => enquirer.ask([{
        type: "list",
        name: "selectedFan",
        message: "Here are your fans",
        choices: _.map(fans, formatFanName),
        transform: answer => _.find(fans, x => answer === formatFanName(x))
    }]));
};

const speedMenu = (ip, answers) => {
    let uid = answers.selectedFan.info.uid;

    return Rx.Observable.from(enquirer.ask([{
        type: "list",
        name: "setSpeed",
        message: `What speed for ${answers.selectedFan.info.name}`,
        choices: ["High", "Medium", "Low"]
    }]))
        .flatMap(answers => {
            switch(answers.setSpeed) {
            case "High":
                return fanControl.setCurrentSpeed(ip, uid, 3);
            case "Medium":
                return fanControl.setCurrentSpeed(ip, uid, 2);
            case "Low":
                return fanControl.setCurrentSpeed(ip, uid, 1);
            }
        }).flatMap(x => program(ip));
}

const program = (ip) => {
   return mainMenu(ip)
        .flatMap(selected => enquirer.ask([{
            type: "list",
            name: "action",
            message: "What do you want to do?",
            choices: ["Turn On", "Turn Off", "Set Speed", "Update Name", "Update Speed", "Back To Menu"]
        }]))
        .flatMap(answers => {
            switch(answers.action) {
            case "Turn On":
                return fanControl.turnFanOn(ip, answers.selectedFan.info.uid)
                    .flatMap(x => program(ip));
            case "Turn Off":
                return fanControl.turnFanOff(ip, answers.selectedFan.info.uid)
                    .flatMap(x => program(ip));
            case "Set Speed":
                return speedMenu(ip, answers);
            case "Back To Menu":
                return program(ip);
            default:
                return program(ip);
            }
        });
};
program(process.env.CONTROLLER_IP)
    .catch(err => program(ip))
    .subscribe(
        fans => console.log(fans),
        err => console.log(err),
        () => console.log('completed')
    );
