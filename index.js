const Discord = require('discord.js')
const request = require('request')
const cheerio = require('cheerio')
const { token, prefix } = require('./config.json')
const bot = new Discord.Client()
const htmlToText = require('html-to-text')

// Запуск бота
bot.on('ready', () => {
  console.log('Bot have launched');
})

// Обработчик сообщений
bot.on('message', (message) => {
  let text = message.content
  if (text.startsWith(prefix)) {
    //   Переменные контроллера
    let msg = text.split(' '),
      command = msg[0].slice(1),
      args = msg.slice(1)
    // Основной контроллер
    switch (command) {
      case 'search':
        // если пользователь не знает, мы ему покажем
        if (args[0] == undefined) break

        const URL = 'https://torlook.info/'
        let trackerName = '', // для поиска
          interval = [1, 1], // интервал поиска
          skip = 1, // сколько аргументов пропускать
          needMagnet = false, // нужно ли сопостовлять magnet
          addOff = true, // добавлять трекеры с недоступными пирами
          piers = -1 // ограничения на количество пиров

        if (args[0].match(/a\d+\%ALL/) != null) { // !search a<p>%ALL <запрос>
          let param = args[0].split("%")
          interval = [1, 1000]
          piers = Number.parseInt(param[0].slice(1))
          addOff = false
        } else if (args[0].match(/a\d+\%\d+-\d+/) != null) { // !search a<p>%<i>-<j> <запрос>
          interval = args[0].split("-")
          let param = interval[0].split("%")
          interval[0] = Number.parseInt(param[1])
          piers = Number.parseInt(param[0].slice(1))
          addOff = false
        } else if (args[0].match(/a\%\d+-\d+/) != null) { // !search a%<i>-<j> <запрос>
          interval = args[0].split("-")
          interval[0] = Number.parseInt(interval[0].slice(2))
          piers = 0
          addOff = false
        } else if (args[0].match(/m\%\d+-\d+/) != null) { // !search m%<i>-<j> <запрос>
          interval = args[0].split("-")
          interval[0] = Number.parseInt(interval[0].slice(2))
          needMagnet = true
        } else if (args[0].match(/\%\d+-\d+/) != null) { // !search %<i>-<j> <запрос>
          interval = args[0].split("-")
          interval[0] = Number.parseInt(args[0].slice(1))
        } else if (args.length > 1 && args[0].match(/m\%\d+/)) { // !search m%<i> <запрос>
          interval[0] = interval[1] = Number.parseInt(args[0].slice(2))
          needMagnet = true
        } else if (args.length > 1 && args[0].match(/\%\d+/)) { // !search %<i> <запрос>
          interval[0] = interval[1] = Number.parseInt(args[0].slice(1))
        } else { // !search <запрос>
          interval = [1, 5]
          skip = 0
        }

        // Составляем запрос
        args.slice(skip).forEach(element => trackerName += " " + element);
        trackerName += "?lang=ru"

        const begin = Number.parseInt(interval[0] - 1),
          end = Number.parseInt(interval[1] - 1)
        if (end - begin > 4 && needMagnet) {
          message.channel.send("Слишком большой интервал! Не больше 5 запросов в интервале.")
          break
        }
        if ((end-begin) > 1000) end = begin + 1000

        // Массив трекеров
        let result = []

        // Получение трекеров по запросу
        request(encodeURI(URL + trackerName), (error, response, body) => {
          let $ = cheerio.load(body),
            itemsCount = $('div.item').length

          console.log(`Интервал: ${interval} Количество: ${itemsCount}`)
          if (itemsCount == 0) message.channel.send(`По данному запросу нет найденныйх трекеров!`)
          else if (begin > itemsCount) message.channel.send(`Интервал ${begin+1}-${end+1} выходит за границы найденныйх трекеров!`)
          else {
            // Обработка трекеров
            $('div.item').each((i, element) => {
              if (begin <= i && i <= end) {
                let elm = cheerio.load(element), // Получение трекер
                  link = elm('.magneto').prop('data-src') // Получение ссылки на magnet
                // Сallback формирующий объект с информацией о трекере
                const getData = (URLadress, callback) => {
                  if (needMagnet) {
                    // Запрос на получение magnet
                    request(URLadress, (error, response, body) => {
                      // Cоздание объекта с magnet
                      let obj = {
                        name: elm('a').html().replace(/<\/?b>/g, '**'),
                        href: elm('a').attr('href'),
                        seeders: elm('.seeders').text(),
                        leechers: elm('leechers').text(),
                        size: elm('.size').text(),
                        trackerHost: elm('.h2 > a').html(),
                        // Вывод "LOST MAGNET", если magnet не появилась
                        magnet: body.match(/magnet(.*)'/) == null ? 'LOST MAGNET' : body.match(/magnet(.*)'/)[0].slice(0, -1)
                      }
                      callback(obj)
                    })
                  } else {
                    // Создание объекта без magnet
                    let obj = {
                      name: elm('a').html().replace(/<\/?b>/g, '**'),
                      href: elm('a').attr('href'),
                      seeders: elm('.seeders').text(),
                      leechers: elm('leechers').text(),
                      size: elm('.size').text(),
                      trackerHost: elm('.h2 > a').html(),
                      magnet: undefined
                    }
                    callback(obj)
                  }
                }

                getData(encodeURI(URL + link), (obj) => {
                  let item =
// Формирование сообщения
`${htmlToText.fromString(obj.name)}
\`\`\`Позиция: ${i + 1}
Раздача: ${obj.href}
Раздающих: ${obj.seeders}
Вес: ${obj.size}
трекер: ${obj.trackerHost}
${needMagnet? 'magnet: '+obj.magnet :''/*Если нужен magnet - вставляем*/}
\`\`\`\n`
                  result.push({ key: obj.seeders, value: item })
                  console.table("i:{" + i + "} reallen:{" + (result.length) + "} fullen:{" + (end - begin + 1) + "}")

                  if (result.length == (end - begin + 1) || result.length == (itemsCount - begin)) { // Если найдены все трекеры, сортируем и отправляем
                    result.sort((a, b) => { return a.key - b.key; }).reverse()
                    let answer = `*Количество найденныйх трекеров: ${itemsCount}\nКоличество трекеров в интервале: ${Math.min(itemsCount, end + 1) - begin}*\n\n`,
                      send = 0, // Количество отправленных сообщений
                      trekers = 0 // Количество трекеров
                    // Адаптивный вывод результатов
                    result.map(item => {
                      if (item.key > piers)
                      if ((answer.length + item.value.length) < 2000){
                        answer += item.value
                        trekers += 1
                      } else {
                        message.channel.send(answer)
                        answer = ""
                        send += 1
                      }
                    })
                    if (answer != ""){
                      message.channel.send(answer)
                      send += 1
                    }

                    if (trekers == 0) message.channel.send(`Не нашлось трекеров удовлетворяющих запросу...`)
                    else if (!addOff) message.channel.send(`Нашлось ${trekers} трекера(ов) удовлетворяющих запросу, отправленных за ${send} сообщение(й)`)
                  }
                })
              }
            })
          }
        })
        break
        case 'help':
          message.channel.send(`
Допустимые формы команд:
  ?search <запрос> - для получения первых 5 трекеров
  ?search %<i> <запрос> - для получения i-ого трекера
  ?search m%<i> <запрос> - для получения i-ого трекера с ссылкой magnet
  ?search %<i>-<j> <запрос> - для получения с i-ого по j-ый трекеры
  ?search m%<i>-<j> <запрос> - для получения с i-ого по j-ый трекеры с ссылкой magnet
  ?search a%<i>-<j> <запрос> - для получения с i-ого по j-ый трекеры с доступными пирами
  ?search a<p>%<i>-<j> <запрос> - для получения с i-ого по j-ый трекеры с более чем p доступными пирами
  ?search a<p>%ALL <запрос> - для получения всех трекеров с более чем p доступными пирами
          `)
        break
    }
  }
})

bot.login(token)
