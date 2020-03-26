const cheerio = require('cheerio');
const htmlToText= require('html-to-text');
const request = require('request');

class Parser{
    getData(trackerName){
        return new Promise(resolve => request(encodeURI(`https://torlook.info/${trackerName}?lang=ru`),
            (error, response, body)=>{
            resolve(body);
        }))
    }
    parseBody(body){
        const $ = cheerio.load(body);
        const unparsedTorrents = $('div.item');
        const torrentsCount = unparsedTorrents.length;
        let torrents = [];
        unparsedTorrents.each((i, element)=>{
           let elm = cheerio.load(element);
           let torrent = {
               magnetSource: elm('.magneto').prop('data-src'),
               name: elm('a').html().replace(/<\/?b>/g, '**'),
               href: elm('a').attr('href'),
               seeders: elm('.seeders').text(),
               size: elm('.size').text(),
               trackerHost: elm('.h2 > a').html()
           };
           torrents.push(torrent);
        });
        return torrents;
    }
    getTrackers(trackerName){
        return new Promise(resolve => {
            this.getData(trackerName)
                .then(body=>resolve(this.parseBody(body)))
        })
    }
    getDirtyMagnet(magnetSource){
        return new Promise(resolve =>
            request(encodeURI(`https://torlook.info/${magnetSource}`),
                (error, response, body)=>{
                    resolve(body.match(/magnet(.*)'/) == null ? 'LOST MAGNET' : body.match(/magnet(.*)'/)[0].slice(0, -1));
                }))
    }
    getMagnet(trackerName, id, callback){
        return new Promise(resolve => {
            this.getTrackers(trackerName)
                .then(torrents=>{
                    if (torrents.length>=id && id>=0){
                        this.getDirtyMagnet(torrents[id].magnetSource)
                            .then(resolve)
                    }
                    else throw new Error('Id must be in range of 0<=id<=torrents count')
                })
        })
    }
}

module.exports.TorrentParser = Parser;