import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBNn_ygR0MnIPsnI-AiGh6gaRquLbFsmBc",
    authDomain: "expense-tracking-e6243.firebaseapp.com",
    projectId: "expense-tracking-e6243",
    storageBucket: "expense-tracking-e6243.firebasestorage.app",
    messagingSenderId: "860366002531",
    appId: "1:860366002531:web:3d737a12c382d6ebe55b56",
    measurementId: "G-2MJ8Q0BHPK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider, analytics };
