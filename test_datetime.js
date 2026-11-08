const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
console.log(now.toISOString().slice(0, 16));
