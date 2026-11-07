// Cloud sync through Firebase (Firestore). Loaded only when firebase-config.js has a config.
// Each person's data lives in one document: sync/{code}. Knowing the code is what gives access.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,onSnapshot,setDoc} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let app=null;
export async function connect(config,code,onRemote,onError){
  app=app||getApps()[0]||initializeApp(config);
  const auth=getAuth(app);
  if(!auth.currentUser)await signInAnonymously(auth);
  const db=getFirestore(app);
  const ref=doc(db,'sync',code);
  const unsub=onSnapshot(ref,snap=>onRemote(snap.exists()?snap.data():null),err=>onError&&onError(err));
  return {push:payload=>setDoc(ref,payload),close:()=>unsub()};
}
