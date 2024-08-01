const express = require('express');
const http = require('http');
const session = require('express-session');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
  console.log('A user connected');});

// 정적 정보 및 초기 데이터
const basicProfile = ['https://ifh.cc/g/tHNLWX.jpg', 'https://ifh.cc/g/3fa5aW.jpg', 'https://ifh.cc/g/1lsJb6.jpg'];
let allUsers = [
  { username: 'babobox', password: 'examplePassword', profile: basicProfile[2], backgroundProfile: 'basic', nickname: '바보상자', email: 'example@example.com',sticker : ["일반"] }
];
let communityArticles = [];
let warnedIP = [];

app.set('trust proxy', true);

app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false
}));
3
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 라우팅 경로 설정
const routes = {
  '/': 'index.html',
  '/comu': 'comu.html',
  '/lab': 'lab.html',
  '/mypage': 'mypage.html',
  '/login': 'login.html',
  '/signup': 'signup.html',
  '/art': '404.html',
  '/ws': '404.html'
};

// 라우팅 처리
Object.entries(routes).forEach(([urlPath, fileName]) => {
  app.get(urlPath, (req, res) => {
    const clientIP = req.ip;
    if (warnedIP.includes(clientIP)) {
      res.sendFile(path.join(__dirname, 'warning.html'));
    } else {
      res.sendFile(path.join(__dirname, fileName));
    }
  });
});

// API 엔드포인트

// 프로필 변경
app.get('/changeProfile', (req, res) => {
  const type = req.headers.type;
  if (type === 'profile') {
    let counter = (basicProfile.indexOf(req.session.profile) + 1) % basicProfile.length;
    req.session.profile = basicProfile[counter];
    updateUserProfile(req.session.username, req.session.profile);
    //console.log(allUsers);
    //console.log(req.session.allLoginUserInfo);
    allLoginUserInfoSet(req);
    res.json(['프로필 변경 성공']);
  } else {
    res.status(400).json({ error: '잘못된 요청' });
  }
});

// 로그인된 모든 사용자 정보 가져오기
app.get('/getAllUserInfo', (req, res) => {
  if (req.session.isLogin) {
    res.json([req.session.allLoginUserInfo]);
  } else {
    res.status(401).json({ error: '세션이 로그인되어 있지 않습니다.' });
  }
});

// 커뮤니티 게시글 가져오기
app.get('/getCommunityArticles', (req, res) => {
  res.json(communityArticles);
});

// 마이페이지 사용자 정보 가져오기
app.get('/getMyPageUserInfo', (req, res) => {
  const getUser = req.headers.getuser.toLowerCase();
  const userExist = allUsers.find(user => user.username.toLowerCase() === getUser);
  if (userExist) {
    res.json({
      username: userExist.username,
      profile: userExist.profile,
      backgroundProfile: userExist.backgroundProfile,
      nickname: userExist.nickname
    });
  } else {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }
});

// 로그인
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const userExist = allUsers.find(user => user.username === username && user.password === password);
  if (userExist) {
    req.session.isLogin = true;
    req.session.username = userExist.username;
    req.session.nickname = userExist.nickname;
    req.session.profile = userExist.profile;
    req.session.backgroundProfile = userExist.backgroundProfile;
    req.session.email = userExist.email;
    req.session.sticker = userExist.sticker;
    req.session.allLoginUserInfo = {
      username: req.session.username,
      nickname: req.session.nickname,
      email: req.session.email,
      profile: req.session.profile,
      backgroundProfile: req.session.backgroundProfile,
      sticker : req.session.sticker
    };

    console.log(`${req.session.allLoginUserInfo.nickname}님이 로그인 하셨습니다.`);
    res.redirect('/?login=true');
  } else {
    res.redirect('/login?error=1');
  }
});

// 회원가입
app.post('/signup', (req, res) => {
  const { username, nickname, email, password, confirm_password } = req.body;

  const usernameRegex = /^[a-zA-Z0-9_]{3,}$/;
  const nicknameRegex = /^[가-힣a-zA-Z]{2,6}$/;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/;

  if (!usernameRegex.test(username) || !nicknameRegex.test(nickname) || !emailRegex.test(email) || !passwordRegex.test(password) || password !== confirm_password) {
    const clientIP = req.ip;
    warnedIP.push(clientIP);
    console.log(`IP: ${clientIP} banned - tried username/nickname: ${username}/${nickname}`);
    return res.sendFile(path.join(__dirname, 'warning.html'));
  }

  const existingUser = allUsers.find(user => user.username === username || user.nickname === nickname);
  if (existingUser) {
    return res.redirect(`/signup?error=6&email=${encodeURIComponent(email)}`);
  }

  allUsers.push({
    username,
    nickname,
    email,
    password,
    profile: basicProfile[1],
    backgroundProfile: 'basic',
    sticker : ["일반"]
  });
  console.log(`${nickname}님이 가입하셨습니다.`);
  res.redirect('/login');
});

// 커뮤니티 게시글 작성
app.post('/comu', (req, res) => {
  const { articleContent } = req.body;
  if (req.session.isLogin) {
    const articleDate = getCurrentDateTime();
    communityArticles.unshift({
      username: req.session.allLoginUserInfo.username,
      nickname: req.session.allLoginUserInfo.nickname,
      content: articleContent,
      date: articleDate,
      profile: req.session.allLoginUserInfo.profile,
      like: 0,
      whoLike: [],
      comment: []
    });
    res.redirect('/comu?login=true');
  } else {
    res.status(401).json({ error: '로그인이 필요합니다.' });
  }
});

// 게시글 좋아요 기능
app.post('/like', (req, res) => {
  const { articleNum } = req.body;
  if (typeof articleNum !== 'number') {
    return res.status(400).json({ error: '글 번호가 유효하지 않습니다.' });
  }
  const article = communityArticles[articleNum-1];
  if (article && !article.whoLike.includes(req.session.username)) {
    article.like++;
    article.whoLike.push(req.session.username);
    return res.json({ like: article.like });
  } 
  else if(article && article.whoLike.includes(req.session.username)) {
    article.like--;
    article.whoLike.splice(article.whoLike.indexOf(req.session.username), 1);
    return res.json({ like: article.like });
  }

  else {
    return res.status(400).json({ error: '글 조회 실패 또는 이미 좋아요를 눌렀습니다.' });
  }
});

app.post('/comment', (req, res) => {
  const { articleNum, commentContent } = req.body;
  const article = communityArticles[articleNum - 1];

  if (article) {
    article.comment.push({
                          username: req.session.allLoginUserInfo.username,
                          nickname: req.session.allLoginUserInfo.nickname,
                          content: commentContent,
                          date: getCurrentDateTime(),
                          profile: req.session.allLoginUserInfo.profile,
                          like: 0,
                          whoLike: [],
                        });
    return res.json({ comment: article.comment });
  } else {
    return res.status(400).json({ error: '글 조회 실패' });
  }
});



// 로그아웃
app.post('/logout', (req, res) => {
  console.log(`${req.session.allLoginUserInfo.nickname}님이 로그아웃 하셨습니다.`)
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[바보상자 : BBB] 의 서버가 포트 ${PORT}에서 실행 중입니다.`);
});

// 현재 날짜와 시간 가져오기
function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear().toString().substr(2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year}-${hours}:${minutes}`;
}

// 사용자 프로필 업데이트
function updateUserProfile(username, newProfile) {
  const userIndex = allUsers.findIndex(user => user.username === username);
  if (userIndex !== -1) {
    allUsers[userIndex].profile = newProfile;
    console.log(`사용자 프로필 업데이트: ${username}`);
  }
}

function allLoginUserInfoSet(req) {
  req.session.allLoginUserInfo = {
    username: req.session.username,
    nickname: req.session.nickname,
    email: req.session.email,
    profile: req.session.profile,
    backgroundProfile: req.session.backgroundProfile
  };
}
