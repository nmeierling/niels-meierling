/**
 * Weather Effects Script
 * Fetches user location via IP, gets weather data, and renders appropriate effects
 */

(function() {
    'use strict';

    // Weather effect container
    let weatherContainer = null;
    let currentWeatherType = null;
    let weatherEnabled = false;
    let weatherDataLoaded = false;

    // Expose test functions globally
    window.testWeather = function(type) {
        const validTypes = ['rain', 'snow', 'sunny', 'cloudy'];
        if (!validTypes.includes(type)) {
            console.log('Usage: testWeather("rain") | testWeather("snow") | testWeather("sunny") | testWeather("cloudy")');
            return;
        }
        if (!weatherContainer) {
            createWeatherContainer();
        }
        currentWeatherType = type;
        weatherEnabled = true;
        updateToggleState();
        renderWeatherEffect(type);
        console.log(`Showing: ${type}`);
    };

    // Expose refresh function for theme changes
    window.refreshWeatherEffect = function() {
        if (currentWeatherType && weatherContainer && weatherEnabled) {
            renderWeatherEffect(currentWeatherType);
        }
    };

    // Expose enable/disable functions
    window.enableWeather = async function() {
        weatherEnabled = true;
        localStorage.setItem('weatherEnabled', 'true');
        updateToggleState();
        if (!weatherContainer) {
            createWeatherContainer();
        }
        if (!weatherDataLoaded) {
            await fetchWeatherData();
        }
        if (currentWeatherType) {
            weatherContainer.style.display = 'block';
            renderWeatherEffect(currentWeatherType);
        }
    };

    window.disableWeather = function() {
        weatherEnabled = false;
        localStorage.setItem('weatherEnabled', 'false');
        updateToggleState();
        if (weatherContainer) {
            weatherContainer.style.display = 'none';
            weatherContainer.innerHTML = '';
        }
    };

    window.toggleWeather = function() {
        if (weatherEnabled) {
            window.disableWeather();
        } else {
            window.enableWeather();
        }
    };

    function updateToggleState() {
        const toggle = document.getElementById('weather-toggle');
        if (toggle) {
            if (weatherEnabled) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    async function init() {
        createWeatherContainer();
        // Start with weather disabled (hidden)
        weatherContainer.style.display = 'none';

        // Set up toggle button
        const toggle = document.getElementById('weather-toggle');
        if (toggle) {
            toggle.addEventListener('click', function() {
                window.toggleWeather();
            });
        }

        // Check if user had weather enabled previously
        const savedWeatherState = localStorage.getItem('weatherEnabled');
        if (savedWeatherState === 'true') {
            await window.enableWeather();
        }
    }

    async function fetchWeatherData() {
        try {
            const location = await getLocationFromIP();
            const weather = await getWeather(location.lat, location.lon);
            currentWeatherType = weather;
            weatherDataLoaded = true;
        } catch (error) {
            console.warn('Weather effects unavailable:', error.message);
        }
    }

    function createWeatherContainer() {
        weatherContainer = document.createElement('div');
        weatherContainer.id = 'weather-effects';
        weatherContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
            overflow: hidden;
        `;
        document.body.appendChild(weatherContainer);
    }

    async function getLocationFromIP() {
        // Using ip-api.com (free, no API key required, 45 requests/minute)
        const response = await fetch('http://ip-api.com/json/?fields=status,lat,lon,city,country');
        const data = await response.json();

        if (data.status !== 'success') {
            throw new Error('Failed to get location from IP');
        }

        console.log(`Location detected: ${data.city}, ${data.country}`);
        return { lat: data.lat, lon: data.lon };
    }

    async function getWeather(lat, lon) {
        // Using Open-Meteo API (free, no API key required)
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,cloud_cover,precipitation`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.current) {
            throw new Error('Failed to get weather data');
        }

        const weatherCode = data.current.weather_code;
        const cloudCover = data.current.cloud_cover;

        // Interpret weather code
        // https://open-meteo.com/en/docs - WMO Weather interpretation codes
        const weatherType = interpretWeatherCode(weatherCode, cloudCover);
        console.log(`Weather: ${weatherType} (code: ${weatherCode}, clouds: ${cloudCover}%)`);

        return weatherType;
    }

    function interpretWeatherCode(code, cloudCover) {
        // WMO Weather interpretation codes
        // 0: Clear sky
        // 1-3: Mainly clear, partly cloudy, overcast
        // 45, 48: Fog
        // 51-57: Drizzle
        // 61-67: Rain
        // 71-77: Snow
        // 80-82: Rain showers
        // 85-86: Snow showers
        // 95-99: Thunderstorm

        if (code >= 71 && code <= 77) return 'snow';
        if (code >= 85 && code <= 86) return 'snow';
        if (code >= 51 && code <= 67) return 'rain';
        if (code >= 80 && code <= 82) return 'rain';
        if (code >= 95 && code <= 99) return 'rain'; // thunderstorm with rain
        if (code === 0 || code === 1) return 'sunny';
        if (code >= 2 || cloudCover > 50) return 'cloudy';

        return 'sunny';
    }

    function renderWeatherEffect(weatherType) {
        weatherContainer.innerHTML = '';

        switch (weatherType) {
            case 'rain':
                renderRain();
                break;
            case 'snow':
                renderSnow();
                break;
            case 'sunny':
                renderSun();
                break;
            case 'cloudy':
                renderClouds();
                break;
        }
    }

    function renderRain() {
        // Add rain CSS
        const style = document.createElement('style');
        style.textContent = `
            .rain-drop {
                position: absolute;
                width: 2px;
                height: 20px;
                background: linear-gradient(transparent, rgba(174, 194, 224, 0.8));
                animation: rain-fall linear infinite;
            }

            @keyframes rain-fall {
                0% {
                    transform: translateY(-100px);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh);
                    opacity: 0.3;
                }
            }
        `;
        document.head.appendChild(style);

        // Create rain drops
        const dropCount = Math.min(150, Math.floor(window.innerWidth / 10));
        for (let i = 0; i < dropCount; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = Math.random() * 100 + '%';
            drop.style.animationDuration = (0.5 + Math.random() * 0.5) + 's';
            drop.style.animationDelay = Math.random() * 2 + 's';
            drop.style.opacity = 0.3 + Math.random() * 0.5;
            weatherContainer.appendChild(drop);
        }
    }

    function renderSnow() {
        // Add snow CSS
        const style = document.createElement('style');
        style.textContent = `
            .snowflake {
                position: absolute;
                color: white;
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
                animation: snow-fall linear infinite;
                user-select: none;
            }

            @keyframes snow-fall {
                0% {
                    transform: translateY(-50px) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(360deg);
                    opacity: 0.5;
                }
            }
        `;
        document.head.appendChild(style);

        // Create snowflakes
        const flakeCount = Math.min(100, Math.floor(window.innerWidth / 15));
        const flakes = ['❄', '❅', '❆', '•'];

        for (let i = 0; i < flakeCount; i++) {
            const flake = document.createElement('div');
            flake.className = 'snowflake';
            flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
            flake.style.left = Math.random() * 100 + '%';
            flake.style.fontSize = (10 + Math.random() * 15) + 'px';
            flake.style.animationDuration = (5 + Math.random() * 10) + 's';
            flake.style.animationDelay = Math.random() * 5 + 's';
            flake.style.opacity = 0.5 + Math.random() * 0.5;
            weatherContainer.appendChild(flake);
        }
    }

    function isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function renderSun() {
        const dark = isDarkMode();

        // Add sun/moon CSS
        const style = document.createElement('style');
        style.id = 'celestial-style';
        style.textContent = dark ? `
            /* Moon styles for dark mode */
            .celestial-body {
                position: absolute;
                top: 20px;
                right: 30px;
                width: 50px;
                height: 50px;
                background: linear-gradient(135deg, #e8e8e8 0%, #c9c9c9 50%, #a0a0a0 100%);
                border-radius: 50%;
                box-shadow:
                    inset -8px -5px 15px rgba(0, 0, 0, 0.2),
                    0 0 30px 8px rgba(255, 255, 255, 0.15),
                    0 0 60px 15px rgba(200, 200, 255, 0.1);
                animation: moon-glow 4s ease-in-out infinite;
            }

            .moon-crater {
                position: absolute;
                background: radial-gradient(circle, rgba(150, 150, 150, 0.6) 0%, rgba(120, 120, 120, 0.3) 100%);
                border-radius: 50%;
            }

            .moon-crater-1 {
                width: 12px;
                height: 12px;
                top: 10px;
                left: 8px;
            }

            .moon-crater-2 {
                width: 8px;
                height: 8px;
                top: 25px;
                left: 20px;
            }

            .moon-crater-3 {
                width: 6px;
                height: 6px;
                top: 15px;
                right: 12px;
            }

            .moon-crater-4 {
                width: 10px;
                height: 10px;
                bottom: 8px;
                left: 15px;
            }

            .moon-star {
                position: absolute;
                width: 2px;
                height: 2px;
                background: white;
                border-radius: 50%;
                animation: twinkle 2s ease-in-out infinite;
            }

            @keyframes moon-glow {
                0%, 100% {
                    box-shadow:
                        inset -8px -5px 15px rgba(0, 0, 0, 0.2),
                        0 0 30px 8px rgba(255, 255, 255, 0.15),
                        0 0 60px 15px rgba(200, 200, 255, 0.1);
                }
                50% {
                    box-shadow:
                        inset -8px -5px 15px rgba(0, 0, 0, 0.2),
                        0 0 40px 12px rgba(255, 255, 255, 0.2),
                        0 0 80px 20px rgba(200, 200, 255, 0.15);
                }
            }

            @keyframes twinkle {
                0%, 100% { opacity: 0.3; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.2); }
            }
        ` : `
            /* Sun styles for light mode */
            .celestial-body {
                position: absolute;
                top: 20px;
                right: 30px;
                width: 60px;
                height: 60px;
                background: radial-gradient(circle, #FFD700 0%, #FFA500 50%, transparent 70%);
                border-radius: 50%;
                box-shadow:
                    0 0 40px 10px rgba(255, 215, 0, 0.4),
                    0 0 80px 20px rgba(255, 165, 0, 0.2);
                animation: sun-pulse 3s ease-in-out infinite;
            }

            .sun-ray {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 100px;
                height: 3px;
                background: linear-gradient(90deg, rgba(255, 215, 0, 0.6), transparent);
                transform-origin: 0 50%;
                animation: ray-pulse 3s ease-in-out infinite;
            }

            @keyframes sun-pulse {
                0%, 100% {
                    transform: scale(1);
                    opacity: 0.9;
                }
                50% {
                    transform: scale(1.1);
                    opacity: 1;
                }
            }

            @keyframes ray-pulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(style);

        // Create celestial body (sun or moon)
        const body = document.createElement('div');
        body.className = 'celestial-body';

        if (dark) {
            // Add moon craters
            for (let i = 1; i <= 4; i++) {
                const crater = document.createElement('div');
                crater.className = `moon-crater moon-crater-${i}`;
                body.appendChild(crater);
            }

            // Add twinkling stars around moon
            const starPositions = [
                { top: -20, right: 80 },
                { top: 10, right: 100 },
                { top: 40, right: 90 },
                { top: -10, right: 120 },
                { top: 60, right: 110 },
                { top: -30, right: 50 },
                { top: 70, right: 70 },
            ];

            starPositions.forEach((pos, i) => {
                const star = document.createElement('div');
                star.className = 'moon-star';
                star.style.top = pos.top + 'px';
                star.style.right = pos.right + 'px';
                star.style.animationDelay = (i * 0.3) + 's';
                body.appendChild(star);
            });
        } else {
            // Create sun rays
            for (let i = 0; i < 8; i++) {
                const ray = document.createElement('div');
                ray.className = 'sun-ray';
                ray.style.transform = `rotate(${i * 45}deg)`;
                ray.style.animationDelay = (i * 0.2) + 's';
                body.appendChild(ray);
            }
        }

        weatherContainer.appendChild(body);
    }

    function renderClouds() {
        const dark = isDarkMode();

        // Add cloud CSS
        const style = document.createElement('style');
        style.textContent = `
            .cloud {
                position: absolute;
                animation: cloud-drift linear infinite;
                filter: ${dark ? 'brightness(0.6)' : 'none'};
            }

            .cloud-body {
                position: absolute;
                background: ${dark
                    ? 'linear-gradient(180deg, rgba(100, 116, 139, 0.9) 0%, rgba(71, 85, 105, 0.8) 100%)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(241, 245, 249, 0.9) 100%)'};
                border-radius: 50%;
                box-shadow: ${dark
                    ? 'inset 0 -5px 15px rgba(0, 0, 0, 0.2), 0 5px 20px rgba(0, 0, 0, 0.3)'
                    : 'inset 0 -8px 20px rgba(200, 200, 200, 0.3), 0 8px 25px rgba(0, 0, 0, 0.1)'};
            }

            .cloud-body.main {
                width: 100%;
                height: 100%;
                z-index: 3;
            }

            .cloud-body.puff-1 {
                width: 45%;
                height: 90%;
                top: -40%;
                left: 10%;
                z-index: 2;
            }

            .cloud-body.puff-2 {
                width: 55%;
                height: 110%;
                top: -55%;
                left: 30%;
                z-index: 4;
            }

            .cloud-body.puff-3 {
                width: 40%;
                height: 80%;
                top: -35%;
                right: 15%;
                z-index: 2;
            }

            .cloud-body.puff-4 {
                width: 30%;
                height: 60%;
                top: -20%;
                right: 5%;
                z-index: 1;
            }

            .cloud-body.puff-5 {
                width: 25%;
                height: 50%;
                top: -15%;
                left: 0%;
                z-index: 1;
            }

            .cloud-highlight {
                position: absolute;
                background: ${dark
                    ? 'radial-gradient(ellipse, rgba(148, 163, 184, 0.4) 0%, transparent 70%)'
                    : 'radial-gradient(ellipse, rgba(255, 255, 255, 0.8) 0%, transparent 70%)'};
                border-radius: 50%;
                width: 60%;
                height: 40%;
                top: 5%;
                left: 20%;
                z-index: 5;
            }

            .cloud-shadow {
                position: absolute;
                background: ${dark
                    ? 'radial-gradient(ellipse, rgba(30, 41, 59, 0.3) 0%, transparent 70%)'
                    : 'radial-gradient(ellipse, rgba(148, 163, 184, 0.2) 0%, transparent 70%)'};
                border-radius: 50%;
                width: 90%;
                height: 30%;
                bottom: -10%;
                left: 5%;
                z-index: 0;
            }

            @keyframes cloud-drift {
                0% {
                    transform: translateX(-250px);
                }
                100% {
                    transform: translateX(calc(100vw + 250px));
                }
            }
        `;
        document.head.appendChild(style);

        // Create detailed clouds
        const cloudCount = 6;
        for (let i = 0; i < cloudCount; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            const width = 120 + Math.random() * 100;
            const height = 40 + Math.random() * 25;
            cloud.style.width = width + 'px';
            cloud.style.height = height + 'px';
            cloud.style.top = (3 + Math.random() * 18) + '%';
            cloud.style.animationDuration = (40 + Math.random() * 50) + 's';
            cloud.style.animationDelay = (-Math.random() * 40) + 's';
            cloud.style.opacity = 0.7 + Math.random() * 0.3;

            // Add cloud parts
            const puffs = ['main', 'puff-1', 'puff-2', 'puff-3', 'puff-4', 'puff-5'];
            puffs.forEach(puff => {
                const part = document.createElement('div');
                part.className = `cloud-body ${puff}`;
                cloud.appendChild(part);
            });

            // Add highlight
            const highlight = document.createElement('div');
            highlight.className = 'cloud-highlight';
            cloud.appendChild(highlight);

            // Add shadow
            const shadow = document.createElement('div');
            shadow.className = 'cloud-shadow';
            cloud.appendChild(shadow);

            weatherContainer.appendChild(cloud);
        }
    }
})();
