import { request, requestWithId, putRequestWithId } from '../request';
import coap from 'coap';

describe('Request', () => {

    let server;

    beforeEach(() => {
        server = coap.createServer();
    });

    afterEach((done) => {
        server.close(done);

    });

    const requestSetup = (serverFunc, clientFunc) => {
        let port = 5683;
        server.on('request', serverFunc);
        let baseUrl = `coap://localhost:${port}`;
        server.listen(port, clientFunc(baseUrl));
    };

    describe('request', () => {
        it('returns an observable', (done) => {
            requestSetup(
                (req, res) => res.end(JSON.stringify({})),
                (baseUrl) => {
                    request(baseUrl)
                        .subscribe(returnedFans => {
                            expect(returnedFans).toEqual({});
                            done();
                        });

                })
        });

        it('returns an error observable if the server throws an exception', (done) => {
            requestSetup(
                (req, res) => {
                    res.code = "5.00"
                    return res.end();
                },
                (baseUrl) => {
                    request(baseUrl)
                        .subscribe(
                            returnedFans => {},
                            err => {
                                expect(err).not.toBeNull();
                                done();
                            })
                });
        });
    });
    describe('requestWithId', () => {
        it('returns if the right fan comes back', (done) => {
            requestSetup(
                (req, res) => {
                    res.end(JSON.stringify({uid:'2'}));
                },
                (baseUrl) => {
                    requestWithId({ip: '1', uid: '2'}, baseUrl)
                        .subscribe(
                            x => {
                                done();
                            },
                        )
                }
            )

        })
        it('throws if the wrong fan comes back', (done) => {
            requestSetup(
                (req, res) => res.end(JSON.stringify({uid:'2'})),
                (baseUrl) => {
                    requestWithId({ip: '1', uid: '1'}, baseUrl)
                        .subscribe(
                            x => {},
                            err => {
                                expect(err.message).toContain("Stupid controller");
                                done();
                            }
                        )
                }
            )
        });

    })
});
