# Weather Bot
The Weather Bot is a Telegram bot designed to provide weather updates and forecasts to users based on their location. It fetches weather data from the Open-Meteo API and generates visual charts as well as verbal forecasts using ChatGPT.

## Table of contents
1. [Features](#features)
2. [Installation](#installation)
3. [Usage](#usage)
4. [Dependencies](#dependencies)
5. [Contributing](#contributing)
6. [License](#license)

## Features
Subscribe to receive daily weather updates.
Unsubscribe from weather updates.
Get current weather information on demand.
Receive weather updates automatically every day at a specified time.
## Installation
1. Clone the repository: ```git clone https://github.com/MrMxffin/1312Bot.git```
2. Install dependencies: ```npm install```
3. Create a `.env` file and add your Telegram bot token and OpenAI API key:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
OWNER_ID=your_telegram_chat_id
```
4. Start the Bot: ```npm start```
## Usage 
- To subscribe to weather updates: /subscribe
- To unsubscribe from weather updates: /unsubscribe
- To get current weather information: /get_weather (only available to the bot owner)
## Dependencies
- dotenv
- node-telegram-bot-api
- node-cron
- axios
- chartjs-node-canvas
- chatgpt
- fs
## Contributing
Contributions are welcome! Please feel free to open an issue or submit a pull request.License
## License
### Code and Original Content
Unless otherwise stated, all code and original content in this project are released under the [Unlicense](https://unlicense.org), read more about this in the [License file](LICENSE).

### External Data Sources
This project utilizes data from external sources, including:

OpenMeteo: Weather data sourced from OpenMeteo is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de). For more information, visit [Open-Meteo](https://open-meteo.com/).
OpenStreetMaps: Location information obtained from OpenStreetMaps is licensed under the [Open Data Commons Open Database License (ODbL)](http://www.openstreetmap.org/copyright) by the [OpenStreetMap Foundation (OSMF)](https://osmfoundation.org/). For more information, visit [OpenStreetMap](https://www.openstreetmap.org/copyright).
Please ensure compliance with the respective licenses when using this project.
