import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBcsohIYQPD3mZML5IjWvVaejsiVFPCV4s",
  authDomain: "chadbot-cea42.firebaseapp.com",
  projectId: "chadbot-cea42",
  storageBucket: "chadbot-cea42.appspot.com",
  messagingSenderId: "662381729404",
  appId: "1:662381729404:web:45429fd30d3d75e69d9bf9",
  measurementId: "G-5CL4Y6WGKS"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app)