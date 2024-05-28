import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import axios from 'axios';
import {ChartJSNodeCanvas} from 'chartjs-node-canvas';
import {ChatGPTAPI} from 'chatgpt';
import fs from 'fs';

dotenv.config();


async function getVerbalForecast(forecast, suburb, time) {
    try {
        const api = new ChatGPTAPI({
            apiKey: process.env.OPENAI_API_KEY
        });
        const prompt = `Zeit: ${formatISO8601TimeLabel(time)}, Ort: ${suburb} Wetterbericht: ${forecast}. Wandle diese Daten in einen verbalen Wetterbericht um, der die Veränderungen über die Zeit in unter 800 Zeichen zusammenfassend darstellt. Gib zum Schluss eine kurze Kleidungsempfehlung.`
        const res = await api.sendMessage(prompt);

        // Attribution for OpenStreetMap (http://www.openstreetmap.org/copyright)
        const osmAttribution = "[Map data © OpenStreetMap contributors](http://www.openstreetmap.org/copyright)";

        // Attribution for Open-Meteo (https://open-meteo.com/) licensed under CC BY 4.0
        const openMeteoAttribution = "[Weather data © Open-Meteo, licensed under CC BY 4.0](https://open-meteo.com/)";


        return `${res.text}\n${osmAttribution}\n${openMeteoAttribution}`;

    } catch (error) {
        console.error('Error in getVerbalForecast:', error);
        // Handle the error or throw it again if needed
        throw error;
    }
}

// Extracted default values into structured variables
const defaultConfig = {
    latitude: 51.3079,
    longitude: 12.3761,
    timezone: "Europe%2FBerlin",
    forecast_days: 1,
    forecast_hours: 24,
    hourlyParams: [
        'temperature_2m',
        'precipitation_probability',
        'rain',
        'showers',
        'snowfall',
        'cloud_cover',
        'wind_speed_10m',
    ],
};

const defaultColors = {
    backgroundColor: 'black',
    gridColor: 'gray',
    tickColor: 'white',
    lineColors: ['rgba(255, 0, 0, 1)', 'rgba(0, 255, 0, 1)', 'rgba(0, 0, 255, 1)'],

};

const defaultChartSize = {
    width: 1920,
    height: 1080,
};

// Initialize Telegram Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});

// Initialize ChartJSNodeCanvas
const canvasRenderService = new ChartJSNodeCanvas({
    width: defaultChartSize.width,
    height: defaultChartSize.height,
    backgroundColour: defaultColors.backgroundColor,
});

// Function to handle errors
function handleRequestError(error, errorMessage) {
    console.error(errorMessage, error.message);
    return `Unable to fetch data at the moment.`;
}

// Function to fetch weather data from OpenWeatherMap API
async function fetchWeatherData(latitude, longitude, timezone, forecastDays, forecastHours, hourlyParams) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=${hourlyParams.join(',')}&timezone=${timezone}&forecast_days=${forecastDays}&forecast_hours=${forecastHours}`
        console.log(`Trying to fetch data from ${url}`)
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        return handleRequestError(error, 'Error fetching weather data:');
    }
}

function getAdjustedBounds(data, bounds) {
    console.log(JSON.stringify(data))
    console.log(JSON.stringify(bounds))
    if (Math.max(...data) === Math.min(...data)) {
        return bounds
    } else {
        return {}
    }
}

// Function to generate a chart using Chart.js
async function generateChart(type, labels, data, label, lineColor, bounds) {
    const adjustedBounds = getAdjustedBounds(data, bounds)
    const configuration = {
        type: type,
        data: {
            labels: labels,
            datasets: [
                getDataset(label, data, lineColor)
            ]
        },
        options: {
            scales: {
                x: getAxisOptions(defaultColors.tickColor, defaultColors.gridColor),
                y: getAxisOptions(defaultColors.tickColor, defaultColors.gridColor, adjustedBounds),
            },
            plugins: {
                legend: {
                    labels: {
                        color: defaultColors.gridColor,
                        font: {
                            size: 20
                        }
                    },
                },
            },
        },
    };

    return await canvasRenderService.renderToBuffer(configuration);
}

// Function to get dataset for the chart
function getDataset(label, data, lineColor) {
    return {
        label: label,
        data: data,
        fill: false,
        backgroundColor: lineColor,
        borderColor: lineColor,
        borderWidth: 3,
        cubicInterpolationMode: 'monotone',
    };
}

// Function to generate combined chart with multiple datasets
async function generateCombinedChart(timeLabels, precipitationData, label, bounds) {
    const {rain, showers, snowfall} = precipitationData;
    let data = []
    for (const precipitationType of [rain, showers, snowfall]) {
        data = data.concat(...precipitationType.data);
    }
    const adjustedBounds = getAdjustedBounds(data, bounds)
    const configuration = {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                getDataset(label + `[Regen] (${rain.unit})`, rain.data, defaultColors.lineColors[0]),
                getDataset(label + `[Schauer] (${showers.unit})`, showers.data, defaultColors.lineColors[1]),
                getDataset(label + `[Schnee] (${snowfall.unit})`, snowfall.data, defaultColors.lineColors[2]),
            ],
        },
        options: {
            scales: {
                x: getAxisOptions(defaultColors.tickColor, defaultColors.gridColor),
                y: getAxisOptions(defaultColors.tickColor, defaultColors.gridColor, adjustedBounds),
            },
            plugins: {
                legend: {
                    labels: {
                        color: defaultColors.gridColor,
                        font: {
                            size: 20,
                        }
                    },
                },
            },
        },
    };

    return await canvasRenderService.renderToBuffer(configuration);
}

// Function to get axis options for the chart
function getAxisOptions(tickColor, gridColor, adjustedBounds) {
    if (adjustedBounds) {
        console.log("max:", adjustedBounds && adjustedBounds.maxAxisValue)
        console.log("min:", adjustedBounds && adjustedBounds.minAxisValue, "\n")
    }
    return {
        ticks: {
            color: tickColor,
            borderWidth: 3,
            font: {
                size: 20
            }
        },
        grid: {
            color: gridColor,
            lineWidth: 3,
        },
        max: adjustedBounds && adjustedBounds.maxAxisValue,
        min: adjustedBounds && adjustedBounds.minAxisValue,
    };
}

// Function to format ISO8601 time label
function formatISO8601TimeLabel(iso8601TimeLabel) {
    const date = new Date(iso8601TimeLabel);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes} Uhr`;
}


// Function to fetch weather data and generate charts and forecast
async function fetchAndGenerateData(latitude, longitude, timezone, forecastDays, forecastHours, hourlyParams, suburb) {
    try {
        const weatherData = await fetchWeatherData(latitude, longitude, timezone, forecastDays, forecastHours, hourlyParams);

        const timeLabels = weatherData.hourly.time.map((timeLabel) => formatISO8601TimeLabel(timeLabel));
        const precipitationData = {
            rain: {
                unit: weatherData.hourly_units.rain,
                data: weatherData.hourly.rain,
            },
            showers: {
                unit: weatherData.hourly_units.showers,
                data: weatherData.hourly.showers,
            },
            snowfall: {
                unit: weatherData.hourly_units.snowfall,
                data: weatherData.hourly.snowfall,
            },
        };

        const temperatureChart = await generateChart('line', timeLabels, weatherData.hourly.temperature_2m, 'Temperatur (°C)', defaultColors.lineColors[0]);
        const precipitationChart = await generateCombinedChart(timeLabels, precipitationData, 'Niederschlag', {minAxisValue: 0});
        const windSpeedChart = await generateChart('line', timeLabels, weatherData.hourly.wind_speed_10m, 'Windgeschwindigkeit (km/h)', defaultColors.lineColors[0], {minAxisValue: 0});
        const cloudCoverChart = await generateChart('line', timeLabels, weatherData.hourly.cloud_cover, 'Bewölkung (%)', defaultColors.lineColors[0], {
            maxAxisValue: 100,
            minAxisValue: 0
        });
        const precipitationProbabilityChart = await generateChart('line', timeLabels, weatherData.hourly.precipitation_probability, 'Niederschlagswahrscheinlichkeit (%)', defaultColors.lineColors[0], {
            maxAxisValue: 100,
            minAxisValue: 0
        });

        const verbalForecastPromise = getVerbalForecast(JSON.stringify(weatherData), suburb, new Date());

        return {
            temperatureChart,
            precipitationProbabilityChart,
            precipitationChart,
            cloudCoverChart,
            windSpeedChart,
            verbalForecast: await verbalForecastPromise,
        };
    } catch (error) {
        console.error('Error fetching and generating data:', error.message);
        throw error;
    }
}


// Function to fetch location information using Nominatim
async function fetchLocationInfo(latitude, longitude) {
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        return response.data.address.suburb; // Adjust the path to match the response structure
    } catch (error) {
        return handleRequestError(error, 'Error fetching location data:');
    }
}

// JSON file to store subscribed chat IDs and message thread IDs
const subscriptionFile = './data/subscriptions.json';

// Function to load subscriptions from the JSON file
function loadSubscriptions() {
    try {
        const data = fs.readFileSync(subscriptionFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Function to save subscriptions to the JSON file
function saveSubscriptions(subscriptions) {
    fs.writeFileSync(subscriptionFile, JSON.stringify(subscriptions, null, 2), 'utf-8');
}

// Function to check if a chat ID and message thread ID are already subscribed
function isSubscribed(chatId, messageThreadId) {
    return subscriptions.some(sub => sub.chatId === chatId && sub.messageThreadId === messageThreadId);
}


// Load existing subscriptions
let subscriptions = loadSubscriptions();

// Command to handle subscription and unsubscription
function handleSubscriptionCommand(msg, subscribe) {
    const chatId = msg.chat.id;
    const messageThreadId = msg.message_thread_id;

    if (subscribe && !isSubscribed(chatId,messageThreadId)) {
        subscriptions.push({ chatId, messageThreadId });
        saveSubscriptions(subscriptions);
        bot.sendMessage(chatId, 'You have subscribed to weather updates.', { message_thread_id: messageThreadId });
    } else if (!subscribe && isSubscribed(chatId, messageThreadId)) {
        subscriptions = subscriptions.filter(sub => !(sub.chatId === chatId && sub.messageThreadId === messageThreadId));
        saveSubscriptions(subscriptions);
        bot.sendMessage(chatId, 'You have unsubscribed from weather updates.', { message_thread_id: messageThreadId });
    } else {
        const message = subscribe ? 'You are already subscribed.' : 'You are not currently subscribed.';
        bot.sendMessage(chatId, message, { message_thread_id: messageThreadId });
    }
}

// Command to handle /subscribe
bot.onText(/\/subscribe/, (msg) => {
    handleSubscriptionCommand(msg, true);
});

// Command to handle /unsubscribe
bot.onText(/\/unsubscribe/, (msg) => {
    handleSubscriptionCommand(msg, false);
});

// Modify the schedule to check if the chat is subscribed before sending updates
cron.schedule('12 13 * * *', async () => {
    if (subscriptions.length === 0) return;
    try {
        const { media, verbalForecast } = await fetchAndGenerateWeatherData();

        // Iterate through subscribed chat IDs and message thread IDs and send updates with stored charts and forecast
        for (const subscription of subscriptions) {
            const { chatId, messageThreadId } = subscription;

            // Send the media group first
            await bot.sendMediaGroup(chatId, media, {message_thread_id: messageThreadId});

            // Finally, send the verbal forecast
            await bot.sendMessage(chatId, verbalForecast, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                message_thread_id: messageThreadId // Include the message thread ID
            });
        }
    } catch (error) {
        console.error('Error fetching and sending data:', error.message);
    }
});


// Function to fetch location information and generate weather data
async function fetchAndGenerateWeatherData() {
    const suburb = await fetchLocationInfo(defaultConfig.latitude, defaultConfig.longitude);
    const config = {...defaultConfig, suburb};

    // Fetch data and generate charts and forecast
    const {
        temperatureChart,
        precipitationProbabilityChart,
        precipitationChart,
        cloudCoverChart,
        windSpeedChart,
        verbalForecast,
    } = await fetchAndGenerateData(
        config.latitude,
        config.longitude,
        config.timezone,
        config.forecast_days,
        config.forecast_hours,
        config.hourlyParams,
        suburb
    );

    // Create an array of media objects
    const media = [
        {type: 'photo', media: temperatureChart, caption: 'Temperaturvorhersage'},
        {type: 'photo', media: precipitationChart, caption: 'Niederschlagsvorhersage'},
        {type: 'photo', media: windSpeedChart, caption: 'Windgeschwindigkeit Vorhersage'},
        {type: 'photo', media: cloudCoverChart, caption: 'Bewölkung Vorhersage'},
        {
            type: 'photo',
            media: precipitationProbabilityChart,
            caption: 'Niederschlagswahrscheinlichkeit Vorhersage'
        },
    ];

    return {media, verbalForecast};
}

// Command to get current weather information on demand
bot.onText(/\/get_weather/, async (msg) => {
    if (msg.from.id.toString() !== process.env.OWNER_ID) {
        return;
    }
    const chatId = msg.chat.id;
    const messageThreadId = msg.message_thread_id;

    try {
        const {media, verbalForecast} = await fetchAndGenerateWeatherData();

        // Send the media group
        await bot.sendMediaGroup(chatId, media, {message_thread_id: messageThreadId});

        // Send the verbal forecast
        await bot.sendMessage(chatId, verbalForecast, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            message_thread_id: messageThreadId
        });
    } catch (error) {
        console.error('Error fetching and sending data:', error.message);
        bot.sendMessage(chatId, 'Unable to fetch weather data at the moment.', {message_thread_id: messageThreadId});
    }
});

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const messageThreadId = msg.message_thread_id;

    const startMessage = `Willkommen zum Wetter-Bot!\n\nHier sind einige Befehle, die du verwenden kannst:\n\n` +
        `/subscribe - Abonniere Wetteraktualisierungen für diesen Chat.\n` +
        `/unsubscribe - Deabonniere Wetteraktualisierungen für diesen Chat.\n` +
        `/get_weather - Erhalte aktuelle Wetterinformationen auf Anfrage (nur für den Bot-Besitzer).\n\n` +
        `Du wirst automatisch jeden Tag um 13:12 Uhr Wetteraktualisierungen erhalten, wenn du abonniert bist.`;

    bot.sendMessage(chatId, startMessage, {message_thread_id: messageThreadId});
});
