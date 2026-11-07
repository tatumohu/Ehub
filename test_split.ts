const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
const iso = now.toISOString().slice(0, 16);
const date = iso.split('T')[0];
const time = iso.split('T')[1];
console.log(date, time);
