/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                cyber: {
                    navy: '#050B14',
                    black: '#02040A',
                    cyan: '#00F0FF',
                    amber: '#FFB000',
                    neonGreen: '#39FF14',
                    red: '#FF003C',
                }
            },
        },
    },
    plugins: [],
}
