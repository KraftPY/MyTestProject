const express = require('express');
const favicon = require('serve-favicon');
const app = express();
// модуль для обработки POST запроса
const bodyParser = require('body-parser');
// модуль для работы с путями к статик. файлами
const path = require('path');

const User = require('./models/user');

// подкл. шаблонизатор для Express и указываем папку по умолч. с шаблонами
app.set('view engine', 'ejs');
app.set('views', './views');

// указываем путь к favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
// указываем чтоб app использовало для декодирования POST запросов body-parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// указываем путь к статическим файлам
app.use('/public', express.static(path.join(__dirname, 'public')));

// Обработка GET/POST запросов

app.get('/', (req, res) => {
	// считываем всех пользователе из БД и передаем в index
	User.find().then((data) => {
		res.render('index', { data });
	});
});

app.post('/authorization', (req, res) => {
	const { login, email, password, rePassword } = req.body;

	console.log(login, email, password, rePassword);
	res.json({ status: true, msg: 'Failed registration!' });
});

app.post('/testPost', (req, res) => {
	const { login, pass } = req.body;

	// создаем нового пользователя БД
	User.create({
		login: login,
		pass: pass
	}).then((post) => console.log(post._id));

	// const newUser = new User({ login: login, pass: pass });
	// newUser.save().then((post) => console.log(post._id));

	res.redirect('/');
});

module.exports = app;
