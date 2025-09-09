// Firebase imports from node_modules
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc, updateDoc, getDocs, writeBatch, where, serverTimestamp } from "firebase/firestore";

// --- Firebase Configuration from .env file ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};
const __app_id = import.meta.env.VITE_APP_ID || "my-answer-book-app";

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("Firebase 配置不完整！請檢查您的 .env 檔案。");
    alert("應用無法啟動，因為 Firebase 配置缺失。");
    throw new Error("Missing Firebase configuration.");
}

// --- Global State ---
let app, db, auth;
let userId = null;
let currentBookId = null; // Still needed for the Edit Page
let allBooks = [];
let currentBookAnswers = [];
let authInitialized = false;
let booksUnsubscribe = null;
let answersUnsubscribe = null;
let isCreatingDefaultBook = false;
let currentLanguage = localStorage.getItem('language') || 'zh';
let isBooksLoading = true;
let currentAnswerMode = 'single';
let selectedBookIds = [];

// --- UI Elements ---
let homePage, settingsPage, editBookPage, cardFlipArea, cardContent, customModal, modalMessage,
    modalConfirmButton, modalCancelButton, modalCloseButton, settingsButton, authButton, themeToggleButton, sunIcon, moonIcon,
    body, html, noAnswerBooksMessage, answerBooksList, addNewBookButton, backToHomeButton,
    createBookModal, createBookNameInput, confirmCreateBookButton, cancelCreateBookButton,
    displayBookName, inlineEditBookNameInput, editBookAnswersCountDisplay, noEditBookAnswersMessage,
    editBookAnswersList, addNewAnswerButton, backToSettingsFromEditButton, deleteBookButton,
    createAnswerModal, createAnswerTextInput, confirmCreateAnswerButton, cancelCreateAnswerButton,
    singleAnswerTab, batchAnswerTab,
    languageSelector, authModal, closeAuthBtn, loginTab, registerTab, loginForm, registerForm, loginEmail,
    loginPassword, registerEmail, registerPassword, registerConfirmPassword, loginButton,
    registerButton, googleLoginButton, guestModeButton, userDisplayName, userEmail, loginRegisterButton,
    logoutButton, mainTitle, selectBooksButton, bookSelectionModal, bookSelectionList, confirmBookSelectionButton;

// --- Translations & Default Data ---
const translations = {
    zh: {
        appTitle: "你的解答之書",
        cardFrontText: "點擊卡片以獲得解答",
        myBooks: "我的解答之書",
        noBooks: "目前沒有任何解答之書。",
        defaultBookName: "預設解答之書",
        loginSuccess: "登入成功",
        logoutSuccess: "登出成功",
        guestUser: "訪客",
        notLoggedIn: "未登入",
        loading: "載入中...",
        noAnswersInBook: "書本中沒有答案，或尚未選擇書本。",
        bookNameRequired: "請輸入解答之書名稱",
        answerTextRequired: "請輸入解答內容",
        createBookSuccess: "解答之書建立成功！",
        createAnswerSuccess: "解答新增成功！",
        logoutConfirm: "你確定要登出嗎？",
        authError: "驗證錯誤",
        passwordMismatch: "密碼不一致",
        googleLoginButton: "使用 Google 登入",
        deleteBookConfirm: "確定刪除？所有答案將一併被移除。",
        bookDeleted: "解答之書已刪除",
        deleteError: "刪除失敗，請稍後再試",
        deleteAnswerConfirm: "確定要刪除這個答案嗎？",
        answerDeleted: "答案已刪除",
        confirm: "確定",
        cancel: "取消",
        close: "關閉",
        backToHome: "回主頁",
        backToSettings: "返回設定",
        deleteBook: "刪除書本",
        logout: "登出",
        loginRegister: "登入/註冊",
        login: "登入",
        register: "註冊",
        continueAsGuest: "以訪客模式繼續",
        createBookTitle: "建立新的解答之書",
        create: "建立",
        addNewAnswerTitle: "新增解答",
        answersInBook: "書本中的解答",
        answersCountUnit: "條",
        bookNamePlaceholder: "輸入書本名稱",
        answerTextPlaceholder: "輸入新的解答內容...",
        noBooksMessage: "目前沒有任何解答之書。",
        noAnswersMessage: "目前沒有任何解答。",
        updateSuccess: "名稱更新成功！",
        updateError: "更新失敗，請稍後再試。",
        updateAnswerSuccess: "解答更新成功！",
        updateAnswerError: "解答更新失敗。",
        addSingle: "新增單筆",
        addAllAsBatch: "批次新增",
        selectBooks: "選擇解答之書",
        selectedBooks: "已選擇 {count} 本書",
        done: "完成",
        selectBooksTitle: "選擇要使用的書本",
    },
    en: {
        appTitle: "Your Book of Answers",
        cardFrontText: "Click the card to get your answer",
        myBooks: "My Books",
        noBooks: "No books available.",
        defaultBookName: "Default Book of Answers",
        loginSuccess: "Login successful",
        logoutSuccess: "Logout successful",
        guestUser: "Guest",
        notLoggedIn: "Not logged in",
        loading: "Loading...",
        noAnswersInBook: "No answers in selected books, or no book selected.",
        bookNameRequired: "Please enter book name",
        answerTextRequired: "Please enter answer text",
        createBookSuccess: "Book created successfully!",
        createAnswerSuccess: "Answer added successfully!",
        logoutConfirm: "Are you sure you want to log out?",
        authError: "Authentication Error",
        passwordMismatch: "Passwords do not match",
        googleLoginButton: "Sign in with Google",
        deleteBookConfirm: "Are you sure? All answers within it will be permanently removed.",
        bookDeleted: "Book deleted",
        deleteError: "Deletion failed, please try again later",
        deleteAnswerConfirm: "Are you sure you want to delete this answer?",
        answerDeleted: "Answer deleted",
        confirm: "Confirm",
        cancel: "Cancel",
        close: "Close",
        backToHome: "Back to Home",
        backToSettings: "Back to Settings",
        deleteBook: "Delete Book",
        logout: "Logout",
        loginRegister: "Login/Register",
        login: "Login",
        register: "Register",
        continueAsGuest: "Continue as Guest",
        createBookTitle: "Create New Book",
        create: "Create",
        addNewAnswerTitle: "Add New Answer",
        answersInBook: "Answers in Book",
        answersCountUnit: "items",
        bookNamePlaceholder: "Enter book name",
        answerTextPlaceholder: "Enter new answer text...",
        noBooksMessage: "No books available.",
        noAnswersMessage: "No answers available.",
        updateSuccess: "Name updated successfully!",
        updateError: "Update failed, please try again later.",
        updateAnswerSuccess: "Answer updated successfully!",
        updateAnswerError: "Failed to update answer.",
        addSingle: "Add Single",
        addAllAsBatch: "Add Batch",
        selectBooks: "Select Answer Books",
        selectedBooks: "{count} books selected",
        done: "Done",
        selectBooksTitle: "Select books to use",
    }
};

const defaultAnswersData = {
    zh: [ "毫無疑問。", "這很可能。", "你說得對。", "所有的跡象都指向「是」。", "大膽去嘗試吧。", "信賴你的直覺。", "前景一片光明。", "絕對可以！", "這將會發生。", "你內心的聲音是對的。", "相信你自己。", "這是個好主意。", "現在正是時候。", "成功就在眼前。", "答案是肯定的。", "機會就在那裡。", "勇敢地前進吧。", "一切都會順利。", "相信你的心。", "這將會是個驚喜。", "運氣會站在你這邊。", "當然，為什麼不呢？", "答案顯而易見。", "相信時機。", "跟隨光明。", "不要指望它。", "我的回答是否定的。", "最好不要。", "現在最好不要透露。", "答案不明確，再問一次。", "專注於其他事情。", "這是個壞主意。", "暫緩行動，重新思考。", "現在不是最佳時機。", "未來並不樂觀。", "不，你應該換個方向。", "忘了它吧。", "保持現狀。", "還有更好的選擇。", "另尋他法。", "這會帶來麻煩。", "最好還是別冒險。", "你應該再等等。", "這需要更多考慮。", "答案是否定的。", "拭目以待。", "問問你自己的心。", "答案在你心中。", "未來是個謎。", "只有時間會告訴你。", "換個方式再問一次。", "集中精神，再問一次。", "答案就在你身邊。", "這是個深奧的問題。", "答案還未浮現。", "命運還在書寫中。", "不要急著尋找答案。", "答案比你想像的更複雜。", "這取決於你的選擇。", "傾聽周遭的聲音。", "尋求不同的觀點。", "等待宇宙的訊息。", "答案會在適當的時候出現。", "現在還不是知道的時候。", "保持開放的心態。", "做好準備。", "勇敢地面對它。", "踏出第一步。", "保持耐心。", "改變你的視角。", "尋求幫助。", "順其自然。", "享受這個過程。", "找到平衡點。", "釋放你的恐懼。", "專注於當下。", "整理你的思緒。", "學習新事物。", "保持謙遜。", "做出一個決定。", "擁抱未知。", "重新評估。", "傾聽你的身體。", "休息一下。", "活在當下。", "答案就在你眼前，只是你沒看到。", "當然，只要你願意。", "星星說「也許」。", "這很明顯，不是嗎？", "去吃點好吃的，你會得到答案。", "答案在風中飄盪。", "你可能需要一杯咖啡。", "這是一個很好的問題。", "答案是個秘密。", "答案就在書裡。", "這需要一個更強大的力量來回答。", "相信魔法。", "答案就在你的夢裡。", "讓宇宙決定吧。", "答案在明天的咖啡裡。" ],
    en: [ "Without a doubt.", "It is very likely.", "You are right.", "All signs point to yes.", "Go for it boldly.", "Trust your instincts.", "The outlook is bright.", "Absolutely!", "It will happen.", "Your inner voice is correct.", "Believe in yourself.", "This is a good idea.", "Now is the time.", "Success is within reach.", "The answer is yes.", "The opportunity is there.", "Move forward bravely.", "Everything will go smoothly.", "Trust your heart.", "This will be a surprise.", "Luck will be on your side.", "Sure, why not?", "The answer is clear.", "Trust the timing.", "Follow the light.", "Don't count on it.", "My answer is no.", "Better not.", "Better not tell now.", "Reply hazy, try again.", "Focus on something else.", "This is a bad idea.", "Pause and reconsider.", "Now is not the best time.", "The future doesn't look good.", "No, you should change direction.", "Forget about it.", "Maintain the status quo.", "There are better options.", "Look for another way.", "This will cause trouble.", "Better not take the risk.", "You should wait.", "This needs more consideration.", "The answer is no.", "Wait and see.", "Ask your own heart.", "The answer is within you.", "The future is a mystery.", "Only time will tell.", "Ask in a different way.", "Concentrate and ask again.", "The answer is around you.", "This is a profound question.", "The answer hasn't emerged yet.", "Fate is still being written.", "Don't rush to find the answer.", "The answer is more complex than you think.", "It depends on your choice.", "Listen to the voices around you.", "Seek different perspectives.", "Wait for the universe's message.", "The answer will appear at the right time.", "Now is not the time to know.", "Keep an open mind.", "Be prepared.", "Face it bravely.", "Take the first step.", "Be patient.", "Change your perspective.", "Seek help.", "Go with the flow.", "Enjoy the process.", "Find balance.", "Release your fears.", "Focus on the present.", "Organize your thoughts.", "Learn something new.", "Stay humble.", "Make a decision.", "Embrace the unknown.", "Reassess.", "Listen to your body.", "Take a break.", "Live in the present.", "The answer is right in front of you, you just don't see it.", "Of course, if you want to.", "The stars say maybe.", "Isn't it obvious?", "Go eat something good, you'll get the answer.", "The answer is floating in the wind.", "You might need a cup of coffee.", "That's a good question.", "The answer is a secret.", "The answer is in the book.", "This requires a more powerful force to answer.", "Believe in magic.", "The answer is in your dreams.", "Let the universe decide.", "The answer is in tomorrow's coffee." ]
};

// --- Helper Functions ---
function getDefaultAnswers() { return defaultAnswersData[currentLanguage] || defaultAnswersData.zh; }
function t(key) { return translations[currentLanguage][key] || key; }

function updatePageText() {
    const setText = (id, key, attr = 'textContent') => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'google-login-button') {
                element.querySelector('span').textContent = t(key);
            } else {
                element[attr] = t(key);
            }
        }
    };

    document.title = t('appTitle');
    mainTitle.textContent = t('appTitle');
    cardContent.textContent = t('cardFrontText');
    if (auth) updateUserProfileUI(auth.currentUser);

    setText('modal-confirm-button', 'confirm');
    setText('modal-cancel-button', 'cancel');
    setText('modal-close-button', 'close');
    setText('logout-button', 'logout');
    setText('back-to-home-button', 'backToHome');
    setText('back-to-settings-from-edit-button', 'backToSettings');
    setText('delete-book-button', 'deleteBook');
    
    // Auth Modal
    setText('auth-modal-title', 'loginRegister');
    setText('login-tab', 'login');
    setText('register-tab', 'register');
    setText('login-button', 'login');
    setText('register-button', 'register');
    setText('guest-mode-button', 'continueAsGuest');

    // Create Book Modal
    const createBookTitle = document.querySelector('#create-book-modal h4');
    if (createBookTitle) createBookTitle.textContent = t('createBookTitle');
    setText('confirm-create-book-button', 'create');
    setText('cancel-create-book-button', 'cancel');
    setText('create-book-name-input', 'bookNamePlaceholder', 'placeholder');

    // Create Answer Modal
    const createAnswerTitle = document.querySelector('#create-answer-modal h4');
    if (createAnswerTitle) createAnswerTitle.textContent = t('addNewAnswerTitle');
    setText('confirm-create-answer-button', 'confirm');
    setText('cancel-create-answer-button', 'cancel');
    setText('single-answer-tab', 'addSingle');
    setText('batch-answer-tab', 'addAllAsBatch');
    setText('create-answer-text-input', 'answerTextPlaceholder', 'placeholder');

    // Settings Page
    setText('my-books-title', 'myBooks');
    setText('no-answer-books-message', 'noBooksMessage');

    // Edit Book Page
    const editBookAnswersTitle = document.getElementById('edit-book-answers-title');
    if (editBookAnswersTitle) {
        editBookAnswersTitle.innerHTML = `${t('answersInBook')} (<span id="edit-book-answers-count">${currentBookAnswers.length}</span> ${t('answersCountUnit')})`;
        editBookAnswersCountDisplay = document.getElementById('edit-book-answers-count');
    }
    setText('no-edit-book-answers-message', 'noAnswersMessage');

    // Book Selection Modal
    setText('confirm-book-selection-button', 'done');
    const selectBooksTitle = document.querySelector('#book-selection-modal h4');
    if (selectBooksTitle) selectBooksTitle.textContent = t('selectBooksTitle');
    updateSelectButtonText();
}


async function createDefaultAnswerBook() {
    if (isCreatingDefaultBook || !userId) return;
    isCreatingDefaultBook = true;
    try {
        const booksRef = collection(db, `artifacts/${__app_id}/users/${userId}/answerBooks`);
        const q = query(booksRef, where("isDefault", "==", true));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("未找到預設解答之書，正在為新使用者建立。");
            const newBookRef = await addDoc(booksRef, { 
                userId, 
                name: t('defaultBookName'),
                isDefault: true,
                createdAt: serverTimestamp() 
            });

            const answersToUse = getDefaultAnswers();
            const batch = writeBatch(db);
            const answersRef = collection(db, `artifacts/${__app_id}/users/${userId}/answers`);
            answersToUse.forEach(answerText => {
                const newAnswerRef = doc(answersRef);
                batch.set(newAnswerRef, { bookId: newBookRef.id, text: answerText, createdAt: serverTimestamp() });
            });
            await batch.commit();
            console.log("已匯入預設答案到預設書本。");
        }
    } catch (e) {
        console.error("建立或檢查預設解答之書時發生錯誤:", e);
    } finally {
        isCreatingDefaultBook = false;
    }
}

function showPage(page) {
    homePage.classList.add('hidden');
    settingsPage.classList.add('hidden');
    editBookPage.classList.add('hidden');
    page.classList.remove('hidden');
}

function setupBooksListener() {
    if (booksUnsubscribe) booksUnsubscribe();
    if (!userId) return;
    const booksRef = collection(db, `artifacts/${__app_id}/users/${userId}/answerBooks`);
    isBooksLoading = true;
    updateSelectButtonText(); 

    booksUnsubscribe = onSnapshot(booksRef, (snapshot) => {
        allBooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        answerBooksList.innerHTML = '';
        allBooks.forEach(book => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-4 rounded-lg cursor-pointer book-item';
            
            const span = document.createElement('span');
            span.textContent = book.isDefault ? t('defaultBookName') : book.name;
            span.className = 'flex-grow';
            span.addEventListener('click', () => editBook(book.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&times;';
            deleteBtn.className = 'delete-btn ml-4';
            deleteBtn.title = 'Delete Book';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showModal(t('deleteBookConfirm'), true, () => deleteBook(book.id));
            });
            
            li.appendChild(span);
li.appendChild(deleteBtn);
            answerBooksList.appendChild(li);
        });
        isBooksLoading = false;
        noAnswerBooksMessage.classList.toggle('hidden', allBooks.length > 0);
        
        // After books are loaded, set the initial selection
        if (selectedBookIds.length === 0) {
            const defaultBook = allBooks.find(b => b.isDefault);
            if (defaultBook) {
                selectedBookIds.push(defaultBook.id);
            }
        }
        updateSelectButtonText();
        
    }, (error) => {
        console.error("書籍監聽失敗:", error);
        isBooksLoading = false;
        updateSelectButtonText();
    });
}

function editBook(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (book) {
        currentBookId = bookId;
        const bookName = book.isDefault ? t('defaultBookName') : book.name;
        displayBookName.textContent = bookName;
        inlineEditBookNameInput.value = bookName;
        displayBookName.classList.remove('hidden');
        inlineEditBookNameInput.classList.add('hidden');
        showPage(editBookPage);
        setupAnswersListener(book.id);
    }
}

function setupAnswersListener(bookId) {
    if (answersUnsubscribe) answersUnsubscribe();
    if (!userId || !bookId) return;
    currentBookId = bookId;
    const answersRef = collection(db, `artifacts/${__app_id}/users/${userId}/answers`);
    const q = query(answersRef, where("bookId", "==", bookId));
    
    answersUnsubscribe = onSnapshot(q, (snapshot) => {
        currentBookAnswers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        editBookAnswersList.innerHTML = '';

        currentBookAnswers.forEach(answer => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-4 border-b answer-item';
            
            const answerTextContainer = document.createElement('div');
            answerTextContainer.className = 'flex-1 answer-text-container';
            
            const answerDisplay = document.createElement('p');
            answerDisplay.className = 'answer-display cursor-pointer pr-2';
            answerDisplay.textContent = answer.text;

            const answerInput = document.createElement('textarea');
            answerInput.className = 'answer-input w-full p-2 border rounded hidden';
            answerInput.value = answer.text;
            answerInput.rows = 3;

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&times;';
            deleteBtn.className = 'delete-btn ml-4';
            deleteBtn.title = 'Delete Answer';
            
            answerDisplay.addEventListener('click', () => {
                answerDisplay.classList.add('hidden');
                answerInput.classList.remove('hidden');
                answerInput.focus();
                answerInput.select();
            });

            const saveAnswer = () => {
                if (answerInput.value.trim() !== answer.text) {
                    updateAnswer(answer.id, answerInput.value);
                }
                answerDisplay.textContent = answerInput.value.trim();
                answerDisplay.classList.remove('hidden');
                answerInput.classList.add('hidden');
            };

            answerInput.addEventListener('blur', saveAnswer);
            answerInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveAnswer();
                } else if (e.key === 'Escape') {
                    answerInput.value = answer.text;
                    answerDisplay.classList.remove('hidden');
                    answerInput.classList.add('hidden');
                }
            });

            deleteBtn.addEventListener('click', () => {
                showModal(t('deleteAnswerConfirm'), true, () => deleteAnswer(answer.id));
            });

            answerTextContainer.appendChild(answerDisplay);
            answerTextContainer.appendChild(answerInput);
            li.appendChild(answerTextContainer);
            li.appendChild(deleteBtn);
            editBookAnswersList.appendChild(li);
        });

        editBookAnswersCountDisplay.textContent = currentBookAnswers.length;
        noEditBookAnswersMessage.classList.toggle('hidden', currentBookAnswers.length > 0);
    }, (error) => console.error("答案監聽失敗:", error));
}

function updateSelectButtonText() {
    if (!selectBooksButton) return;
    if (selectedBookIds.length === 0) {
        selectBooksButton.textContent = t('selectBooks');
    } else {
        selectBooksButton.textContent = t('selectedBooks').replace('{count}', selectedBookIds.length);
    }
}

function renderBookSelectionModal() {
    if (!bookSelectionList) return;
    bookSelectionList.innerHTML = '';

    if (allBooks.length === 0) {
        const noBooksMessage = document.createElement('p');
        noBooksMessage.className = 'text-center';
        noBooksMessage.textContent = t('noBooksMessage');
        bookSelectionList.appendChild(noBooksMessage);
        return;
    }

    allBooks.forEach(book => {
        const label = document.createElement('label');
        label.className = 'custom-checkbox';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = book.id;
        if (selectedBookIds.includes(book.id)) {
            input.checked = true;
        }

        input.addEventListener('change', () => {
            const tempSelectedIds = new Set(selectedBookIds);
            if (input.checked) {
                tempSelectedIds.add(book.id);
            } else {
                tempSelectedIds.delete(book.id);
            }
            selectedBookIds = Array.from(tempSelectedIds);
        });

        const checkmark = document.createElement('span');
        checkmark.className = 'checkmark';
        checkmark.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        
        const bookName = document.createElement('span');
        bookName.textContent = book.isDefault ? t('defaultBookName') : book.name;

        label.appendChild(input);
        label.appendChild(checkmark);
        label.appendChild(bookName);
        bookSelectionList.appendChild(label);
    });
}

async function getRandomAnswer() {
    if (selectedBookIds.length === 0 || !userId) return null;
    const answersRef = collection(db, `artifacts/${__app_id}/users/${userId}/answers`);
    const q = query(answersRef, where("bookId", "in", selectedBookIds));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        
        const answers = querySnapshot.docs.map(doc => doc.data().text);
        return answers[Math.floor(Math.random() * answers.length)];
    } catch (error) {
        console.error("獲取多本書的答案時出錯:", error);
        return null;
    }
}

async function handleCardClick() {
    cardFlipArea.classList.add('card-generating');
    cardContent.textContent = "正在取得你的答案...";

    const answer = await getRandomAnswer();
    
    cardFlipArea.classList.remove('card-generating');

    if (answer === null) {
        showModal(t('noAnswersInBook'));
        setTimeout(() => {
            cardContent.textContent = t('cardFrontText');
        }, 800);
        return;
    }

    cardContent.style.opacity = '0';
    setTimeout(() => {
        cardContent.textContent = answer;
        cardContent.style.opacity = '1';
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }, 400);
}

function toggleTheme() {
    html.classList.toggle('dark');
    html.classList.toggle('light');
    sunIcon.classList.toggle('hidden');
    moonIcon.classList.toggle('hidden');
    localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
}

function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'toast-message';
     if (document.documentElement.classList.contains('dark')) {
        toast.classList.add('dark');
     }
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showModal(message, showConfirm = false, onConfirm = null) {
    modalMessage.textContent = message;
    const buttonsContainer = document.getElementById('modal-buttons-container');
    if (showConfirm) {
        buttonsContainer.classList.remove('hidden');
        modalCloseButton.classList.add('hidden');
        modalConfirmButton.onclick = () => { customModal.classList.add('hidden'); if (onConfirm) onConfirm(); };
        modalCancelButton.onclick = () => { customModal.classList.add('hidden'); };
    } else {
        buttonsContainer.classList.add('hidden');
        modalCloseButton.classList.remove('hidden');
        modalCloseButton.onclick = () => { customModal.classList.add('hidden'); };
    }
    customModal.classList.remove('hidden');
}

async function createAnswerBook(name) {
    if (!userId) return;
    const booksRef = collection(db, `artifacts/${__app_id}/users/${userId}/answerBooks`);
    try {
        await addDoc(booksRef, {
            userId: userId,
            name: name,
            createdAt: serverTimestamp()
        });
        showToast(t('createBookSuccess'));
    } catch (error) {
        console.error("建立書本時出錯:", error);
        showToast("建立失敗，請稍後再試");
    }
}

async function addNewAnswer(text) {
    if (!userId || !currentBookId) return;
    const answersRef = collection(db, `artifacts/${__app_id}/users/${userId}/answers`);
    try {
        await addDoc(answersRef, {
            bookId: currentBookId,
            text: text,
            createdAt: serverTimestamp()
        });
        showToast(t('createAnswerSuccess'));
    } catch (error) {
        console.error("新增答案時出錯:", error);
        showToast("新增失敗，請稍後再試");
    }
}

async function updateBookName(bookId, newName) {
    const trimmedName = newName.trim();
    if (!userId || !bookId || !trimmedName) return;
    
    const bookRef = doc(db, `artifacts/${__app_id}/users/${userId}/answerBooks`, bookId);
    try {
        await updateDoc(bookRef, { name: trimmedName });
        showToast(t('updateSuccess'));
    } catch (error) {
        console.error("更新書本名稱失敗:", error);
        showToast(t('updateError'));
    }
}

async function updateAnswer(answerId, newText) {
    const trimmedText = newText.trim();
    if (!userId || !answerId || !trimmedText) return;

    const answerRef = doc(db, `artifacts/${__app_id}/users/${userId}/answers`, answerId);
    try {
        await updateDoc(answerRef, { text: trimmedText });
        showToast(t('updateAnswerSuccess'));
    } catch (error) {
        console.error("更新解答內容失敗:", error);
        showToast(t('updateAnswerError'));
    }
}

async function addAnswersInBatch(text) {
    if (!userId || !currentBookId) return;

    const answersArray = text.split('\n')
                             .map(line => line.trim())
                             .filter(line => line.length > 0);

    if (answersArray.length === 0) {
        showToast("請輸入至少一則解答");
        return;
    }

    try {
        const batch = writeBatch(db);
        const answersRef = collection(db, `artifacts/${__app_id}/users/${userId}/answers`);

        answersArray.forEach(answerText => {
            const newAnswerRef = doc(answersRef);
            batch.set(newAnswerRef, {
                bookId: currentBookId,
                text: answerText,
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();
        showToast(`成功新增 ${answersArray.length} 則解答！`);
    } catch (error) {
        console.error("批次新增解答失敗:", error);
        showToast("新增失敗，請稍後再試。");
    }
}

async function deleteBook(bookId) {
    if (!userId) return;
    try {
        const answersRef = collection(db, `artifacts/${__app_id}/users/${userId}/answers`);
        const q = query(answersRef, where("bookId", "==", bookId));
        const answersSnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        answersSnapshot.forEach(doc => { batch.delete(doc.ref); });
        
        const bookRef = doc(db, `artifacts/${__app_id}/users/${userId}/answerBooks`, bookId);
        batch.delete(bookRef);
        await batch.commit();

        showToast(t('bookDeleted'));
        showPage(settingsPage);
    } catch (error) { 
        console.error("刪除書本及其答案時出錯:", error); 
        showToast(t('deleteError'));
    }
}

async function deleteAnswer(answerId) {
    if (!userId) return;
    const answerRef = doc(db, `artifacts/${__app_id}/users/${userId}/answers`, answerId);
    try {
        await deleteDoc(answerRef);
        showToast(t('answerDeleted'));
    } catch (error) {
        console.error("刪除答案時出錯:", error);
        showToast(t('deleteError'));
    }
}

async function registerUser(email, password) {
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) { showToast(t('authError') + ": " + error.message); }
}

async function loginUser(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) { showToast(t('authError') + ": " + error.message); }
}

async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (error) { showToast(t('authError') + ": " + error.message); }
}

async function logoutUser() {
    try {
        await signOut(auth);
        showToast(t('logoutSuccess'));
    } catch (error) { console.error("登出失敗:", error); }
}

function updateUserProfileUI(user) {
    if (!userDisplayName || !userEmail || !logoutButton || !loginRegisterButton) return;
    if (user && !user.isAnonymous) {
        userDisplayName.textContent = user.displayName || user.email.split('@')[0];
        userEmail.textContent = user.email;
        logoutButton.classList.remove('hidden');
        loginRegisterButton.classList.add('hidden');
    } else {
        userDisplayName.textContent = t('guestUser');
        userEmail.textContent = t('notLoggedIn');
        logoutButton.classList.add('hidden');
        loginRegisterButton.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Get All UI Elements ---
    homePage = document.getElementById('home-page');
    settingsPage = document.getElementById('settings-page');
    editBookPage = document.getElementById('edit-book-page');
    cardFlipArea = document.getElementById('card-click-area');
    cardContent = document.getElementById('card-content');
    customModal = document.getElementById('custom-modal');
    modalMessage = document.getElementById('modal-message');
    modalConfirmButton = document.getElementById('modal-confirm-button');
    modalCancelButton = document.getElementById('modal-cancel-button');
    modalCloseButton = document.getElementById('modal-close-button');
    settingsButton = document.getElementById('settings-button');
    authButton = document.getElementById('auth-button');
    themeToggleButton = document.getElementById('theme-toggle');
    sunIcon = document.getElementById('sun-icon');
    moonIcon = document.getElementById('moon-icon');
    body = document.body;
    html = document.documentElement;
    noAnswerBooksMessage = document.getElementById('no-answer-books-message');
    answerBooksList = document.getElementById('answer-books-list');
    addNewBookButton = document.getElementById('add-new-book-button');
    backToHomeButton = document.getElementById('back-to-home-button');
    createBookModal = document.getElementById('create-book-modal');
    createBookNameInput = document.getElementById('create-book-name-input');
    confirmCreateBookButton = document.getElementById('confirm-create-book-button');
    cancelCreateBookButton = document.getElementById('cancel-create-book-button');
    displayBookName = document.getElementById('display-book-name');
    inlineEditBookNameInput = document.getElementById('inline-edit-book-name-input');
    editBookAnswersCountDisplay = document.getElementById('edit-book-answers-count');
    noEditBookAnswersMessage = document.getElementById('no-edit-book-answers-message');
    editBookAnswersList = document.getElementById('edit-book-answers-list');
    addNewAnswerButton = document.getElementById('add-new-answer-button');
    backToSettingsFromEditButton = document.getElementById('back-to-settings-from-edit-button');
    deleteBookButton = document.getElementById('delete-book-button');
    createAnswerModal = document.getElementById('create-answer-modal');
    createAnswerTextInput = document.getElementById('create-answer-text-input');
    confirmCreateAnswerButton = document.getElementById('confirm-create-answer-button');
    cancelCreateAnswerButton = document.getElementById('cancel-create-answer-button');
    singleAnswerTab = document.getElementById('single-answer-tab');
    batchAnswerTab = document.getElementById('batch-answer-tab');
    languageSelector = document.getElementById('language-selector');
    authModal = document.getElementById('auth-modal');
    closeAuthBtn = document.getElementById('auth-close-button');
    loginTab = document.getElementById('login-tab');
    registerTab = document.getElementById('register-tab');
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    loginEmail = document.getElementById('login-email');
    loginPassword = document.getElementById('login-password');
    registerEmail = document.getElementById('register-email');
    registerPassword = document.getElementById('register-password');
    registerConfirmPassword = document.getElementById('register-confirm-password');
    loginButton = document.getElementById('login-button');
    registerButton = document.getElementById('register-button');
    googleLoginButton = document.getElementById('google-login-button');
    guestModeButton = document.getElementById('guest-mode-button');
    userDisplayName = document.getElementById('user-display-name');
    userEmail = document.getElementById('user-email');
    loginRegisterButton = document.getElementById('login-register-button');
    logoutButton = document.getElementById('logout-button');
    mainTitle = document.getElementById('main-title');
    selectBooksButton = document.getElementById('select-books-button');
    bookSelectionModal = document.getElementById('book-selection-modal');
    bookSelectionList = document.getElementById('book-selection-list');
    confirmBookSelectionButton = document.getElementById('confirm-book-selection-button');

    // --- 2. Setup Static Event Listeners ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') { 
        html.classList.add('dark');
        html.classList.remove('light');
        sunIcon.classList.add('hidden'); 
        moonIcon.classList.remove('hidden'); 
    } else { 
        html.classList.add('light');
        html.classList.remove('dark');
        sunIcon.classList.remove('hidden'); 
        moonIcon.classList.add('hidden'); 
    }
    
    languageSelector.value = currentLanguage;
    
    languageSelector.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        localStorage.setItem('language', currentLanguage);
        createDefaultAnswerBook();
        updatePageText();
        setupBooksListener();
        if (editBookPage && !editBookPage.classList.contains('hidden')) {
            const book = allBooks.find(b => b.id === currentBookId);
            if (book) {
                displayBookName.textContent = book.isDefault ? t('defaultBookName') : book.name;
                inlineEditBookNameInput.value = displayBookName.textContent;
            }
        }
    });

    cardFlipArea.addEventListener('click', handleCardClick);
    themeToggleButton.addEventListener('click', toggleTheme);
    settingsButton.addEventListener('click', () => showPage(settingsPage));
    backToHomeButton.addEventListener('click', () => showPage(homePage));
    backToSettingsFromEditButton.addEventListener('click', () => showPage(settingsPage));
    deleteBookButton.addEventListener('click', () => {
        if (currentBookId) {
            showModal(t('deleteBookConfirm'), true, () => deleteBook(currentBookId));
        }
    });
    
    displayBookName.addEventListener('click', () => {
        displayBookName.classList.add('hidden');
        inlineEditBookNameInput.classList.remove('hidden');
        inlineEditBookNameInput.focus();
        inlineEditBookNameInput.select();
    });

    const saveBookName = () => {
        const originalName = displayBookName.textContent;
        const newName = inlineEditBookNameInput.value;
        if (newName !== originalName) {
            updateBookName(currentBookId, newName);
        }
        displayBookName.textContent = newName;
        displayBookName.classList.remove('hidden');
        inlineEditBookNameInput.classList.add('hidden');
    };
    inlineEditBookNameInput.addEventListener('blur', saveBookName);
    inlineEditBookNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveBookName();
        } else if (e.key === 'Escape') {
            inlineEditBookNameInput.value = displayBookName.textContent;
            displayBookName.classList.remove('hidden');
            inlineEditBookNameInput.classList.add('hidden');
        }
    });

    addNewBookButton.addEventListener('click', () => createBookModal.classList.remove('hidden'));
    cancelCreateBookButton.addEventListener('click', () => createBookModal.classList.add('hidden'));
    confirmCreateBookButton.addEventListener('click', async () => {
        const name = createBookNameInput.value.trim();
        if (name) {
            await createAnswerBook(name);
            createBookNameInput.value = '';
            createBookModal.classList.add('hidden');
        } else { showToast(t('bookNameRequired')); }
    });
    
    confirmCreateAnswerButton.addEventListener('click', async () => {
        const text = createAnswerTextInput.value.trim();
        if (!text) {
            showToast(t('answerTextRequired'));
            return;
        }
        if (currentAnswerMode === 'batch') {
            await addAnswersInBatch(text);
        } else {
            await addNewAnswer(text);
        }
        createAnswerTextInput.value = '';
        createAnswerModal.classList.add('hidden');
    });

    singleAnswerTab.addEventListener('click', () => {
        currentAnswerMode = 'single';
        singleAnswerTab.classList.add('auth-tab-active');
        batchAnswerTab.classList.remove('auth-tab-active');
        createAnswerTextInput.placeholder = t('answerTextPlaceholder');
    });

    batchAnswerTab.addEventListener('click', () => {
        currentAnswerMode = 'batch';
        batchAnswerTab.classList.add('auth-tab-active');
        singleAnswerTab.classList.remove('auth-tab-active');
        createAnswerTextInput.placeholder = "每行一則解答...";
    });
    
    addNewAnswerButton.addEventListener('click', () => {
        currentAnswerMode = 'single';
        singleAnswerTab.classList.add('auth-tab-active');
        batchAnswerTab.classList.remove('auth-tab-active');
        createAnswerTextInput.placeholder = t('answerTextPlaceholder');
        createAnswerModal.classList.remove('hidden');
    });
    
    cancelCreateAnswerButton.addEventListener('click', () => {
        createAnswerModal.classList.add('hidden');
        createAnswerTextInput.value = '';
    });
    
    loginRegisterButton.addEventListener('click', () => authModal.classList.remove('hidden'));
    closeAuthBtn.addEventListener('click', () => authModal.classList.add('hidden'));
    authModal.addEventListener('click', (e) => { if (e.target === authModal) authModal.classList.add('hidden'); });
    guestModeButton.addEventListener('click', () => authModal.classList.add('hidden'));
    
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('auth-tab-active'); registerTab.classList.remove('auth-tab-active');
        loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
    });
    registerTab.addEventListener('click', () => {
        registerTab.classList.add('auth-tab-active'); loginTab.classList.remove('auth-tab-active');
        registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
    });

    loginButton.addEventListener('click', async () => {
        if (loginEmail.value && loginPassword.value) await loginUser(loginEmail.value, loginPassword.value);
    });
    registerButton.addEventListener('click', async () => {
        if (registerPassword.value !== registerConfirmPassword.value) { showToast(t('passwordMismatch')); return; }
        if (registerEmail.value && registerPassword.value) await registerUser(registerEmail.value, registerPassword.value);
    });
    googleLoginButton.addEventListener('click', loginWithGoogle);
    logoutButton.addEventListener('click', () => showModal(t('logoutConfirm'), true, logoutUser));

    authButton.addEventListener('click', () => {
        if (!auth) return;
        const user = auth.currentUser;
        if (user && !user.isAnonymous) {
            showModal(t('logoutConfirm'), true, logoutUser);
        } else {
            authModal.classList.remove('hidden');
        }
    });

    selectBooksButton.addEventListener('click', () => {
        renderBookSelectionModal();
        bookSelectionModal.classList.remove('hidden');
    });

    confirmBookSelectionButton.addEventListener('click', () => {
        updateSelectButtonText();
        bookSelectionModal.classList.add('hidden');
    });

    // --- 3. Initialize Firebase & Set Auth Listener ---
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            console.log("Auth state changed. User:", user ? user.uid : null);
            if (booksUnsubscribe) booksUnsubscribe();
            if (answersUnsubscribe) answersUnsubscribe();
            
            updatePageText();

            if (user) {
                userId = user.uid;
                await createDefaultAnswerBook();
                setupBooksListener();
                authModal.classList.add('hidden');
                showPage(homePage);
                if (authInitialized && !user.isAnonymous) showToast(t('loginSuccess'));
            } else {
                console.log("No user found, signing in anonymously...");
                userId = null;
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                    alert("無法啟用訪客模式，請檢查您的網路連線。");
                }
            }
            authInitialized = true;
        });
    } catch (error) {
        console.error("Firebase 初始化失敗:", error);
        alert("無法連接到後端服務，請稍後再試。");
    }
});