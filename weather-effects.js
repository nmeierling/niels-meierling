/**
 * Weather Effects Script
 * Fetches user location via IP, gets weather data, and renders appropriate effects
 */

(function() {
    'use strict';

    // Weather effect container
    let weatherContainer = null;

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
        renderWeatherEffect(type);
        console.log(`Showing: ${type}`);
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    async function init() {
        createWeatherContainer();
        try {
            const location = await getLocationFromIP();
            const weather = await getWeather(location.lat, location.lon);
            renderWeatherEffect(weather);
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

    function renderSun() {
        // Add sun CSS
        const style = document.createElement('style');
        style.textContent = `
            .sun {
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
                0%, 100% {
                    opacity: 0.4;
                }
                50% {
                    opacity: 0.7;
                }
            }
        `;
        document.head.appendChild(style);

        // Create sun
        const sun = document.createElement('div');
        sun.className = 'sun';

        // Create rays
        for (let i = 0; i < 8; i++) {
            const ray = document.createElement('div');
            ray.className = 'sun-ray';
            ray.style.transform = `rotate(${i * 45}deg)`;
            ray.style.animationDelay = (i * 0.2) + 's';
            sun.appendChild(ray);
        }

        weatherContainer.appendChild(sun);
    }

    function renderClouds() {
        // Add cloud CSS
        const style = document.createElement('style');
        style.textContent = `
            .cloud {
                position: absolute;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(220, 220, 220, 0.7) 100%);
                border-radius: 50px;
                animation: cloud-drift linear infinite;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            }

            .cloud::before,
            .cloud::after {
                content: '';
                position: absolute;
                background: inherit;
                border-radius: 50%;
            }

            .cloud::before {
                width: 50%;
                height: 120%;
                top: -50%;
                left: 15%;
            }

            .cloud::after {
                width: 40%;
                height: 100%;
                top: -40%;
                right: 20%;
            }

            @keyframes cloud-drift {
                0% {
                    transform: translateX(-200px);
                }
                100% {
                    transform: translateX(calc(100vw + 200px));
                }
            }
        `;
        document.head.appendChild(style);

        // Create clouds
        const cloudCount = 5;
        for (let i = 0; i < cloudCount; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            const width = 80 + Math.random() * 120;
            const height = 30 + Math.random() * 30;
            cloud.style.width = width + 'px';
            cloud.style.height = height + 'px';
            cloud.style.top = (5 + Math.random() * 20) + '%';
            cloud.style.animationDuration = (30 + Math.random() * 40) + 's';
            cloud.style.animationDelay = (-Math.random() * 30) + 's';
            cloud.style.opacity = 0.6 + Math.random() * 0.3;
            weatherContainer.appendChild(cloud);
        }
    }
})();
