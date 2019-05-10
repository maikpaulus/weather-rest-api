const config = require('config');
const express = require('express');
const moment = require('moment');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const fs = require('fs');
const path = require('path');
const MongoClient = require('mongodb').MongoClient;

app.use(bodyParser.json());
app.use(cors());

app.get('/device/thermostat/:id', (req, res) => {
    const id = req.params.id;

    getDeviceDataById(id, (err, data) => {
        if (err) {
            return res.status(500).send({
                success: false,
                response: {
                    message: err.message
                }
            });
        }

        return res.status(200).send({
            success: true, 
            response: {
                id,
                device: data.body
            }
        });
    });
});

app.post('/device/thermostat/:id', (req, res) => {
    const id = req.params.id;
    const deviceData = req.body;

    deviceData['id'] = id;
    res.set('Access-Control-Allow-Origin', '*');

    saveDeviceData(id, deviceData, (err) => {
        if (err) {
            return res.status(500).send({
                success: false,
                response: {
                    message: err.message
                }
            });
        }

        return res.status(200).send({
            success: true, 
            response: {
                id
            }
        });
    });
});

app.get('*', (req, res) => {
    readDataFromDb((err, data) => {
        if (err) { 
            return res.status(500).json({
                httpCode: 500,
                success: false,
                error: err
            }); 
        }

        let current = groupDataById(data);

        Object.keys(current).forEach((id) => {
            current[id] = current[id].pop();
            delete current[id]._id;
        });
        
        res.set('Access-Control-Allow-Origin', '*');

        res.status(200).json({
            httpCode: 200,
            success: true, 
            response: {
                current
            }
        });
    });
});

app.listen(config.get('server.port'), () => {
    console.log('app is listening...');
});

let readDataFromDb = (callback) => {
    MongoClient.connect(getDatabaseUrl(config.get('database')), (err, db) => {
        if (err) { 
            return callback(err); 
        }

        let weatherCollection = db.collection('weather');

        weatherCollection.find({}).toArray((err, docs) => {
            db.close();
            
            if (err) { 
                return callback(err); 
            }
            
            return callback(null, docs);
        });

    });
};

let getDeviceDataById = (id, callback) => {
    MongoClient.connect(getDatabaseUrl(config.get('database')), (err, db) => {
        if (err) { 
            return callback(err); 
        }

        let weatherCollection = db.collection('device');

        weatherCollection.findOne({ id }, (err, document) => {
            db.close();

            if (err) { 
                return callback(err); 
            }
            
            return callback(null, document);
        });

    });
};

const saveDeviceData = (id, data, callback) => {
    MongoClient.connect(getDatabaseUrl(config.get('database')), (err, db) => {
        if (err) { 
            return callback(err); 
        }

        let deviceCollection = db.collection('device');

        deviceCollection.update({ id }, data, { upsert: true }, (err) => {
            if (err) { 
                return callback(err); 
            }
            
            return callback(null);
        });
    })
}

const getDatabaseUrl = (config) => {
  return [
    'mongodb://', config.user, ':', config.password, '@', config.host, ':', config.port, '/', config.database
  ].join('');
};

const groupDataById = (data) => {
    let groupedData = {};
    
    data.forEach((measurement) => {
        if (!groupedData[measurement.id]) {
            groupedData[measurement.id] = [];
        }

        groupedData[measurement.id].push(measurement);
    });
    return groupedData;
};