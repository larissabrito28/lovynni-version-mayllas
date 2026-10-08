import { firebaseConfig } from './firebase-config.js';
const $=s=>document.querySelector(s);
const store=window.LovynniStore;
let mode='login', auth=null, db=null, activeUser=null, saveQueue=Promise.resolve(), session=0;
const configured=['apiKey','authDomain','projectId','appId'].every(k=>Boolean(firebaseConfig[k]));
const message=t=>{if($('#authMessage'))$('#authMessage').textContent=t};
const notice=$('#authSetupNotice');
const form=$('#authForm');
function chooseMode(value){mode=value;$('#tabLogin').classList.toggle('selected',mode==='login');$('#tabRegister').classList.toggle('selected',mode==='register');$('#nameField').hidden=mode!=='register';$('#authName').required=mode==='register';$('#authPassword').autocomplete=mode==='register'?'new-password':'current-password';$('#authSubmit').textContent=mode==='register'?'CRIAR MINHA CONTA ↗':'ENTRAR NA MINHA CONTA ↗';$('#resetPassword').hidden=mode==='register';message('')}
$('#tabLogin')?.addEventListener('click',()=>chooseMode('login'));
$('#tabRegister')?.addEventListener('click',()=>chooseMode('register'));
$('#accountFavorites')?.addEventListener('click',()=>store.openDrawer('favorites'));
$('#accountCart')?.addEventListener('click',()=>store.openDrawer('cart'));
function showUser(user){$('#authGuest').hidden=!!user;$('#authLogged').hidden=!user;if(user){$('#accountName').textContent=user.displayName?`Olá, ${user.displayName}.`:'Bem-vinda à LOVYNNI.';$('#accountEmail').textContent=user.email||''}}
function friendly(error){const code=error?.code||'';if(code==='auth/email-already-in-use')return 'Este e-mail já tem uma conta. Selecione Entrar.';if(code==='auth/weak-password')return 'Escolha uma senha mais forte (mínimo de 6 caracteres).';if(code==='auth/invalid-email')return 'Informe um e-mail válido.';if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(code))return 'E-mail ou senha incorretos.';if(code==='auth/too-many-requests')return 'Muitas tentativas. Aguarde um pouco.';if(code==='auth/operation-not-allowed')return 'Ative o método E-mail/senha no Firebase Authentication.';return 'Não foi possível concluir a operação. Tente novamente.'}
if(!configured){notice.hidden=false;notice.textContent='Cadastro e login aguardando configuração do Firebase LOVYNNI. Enquanto isso, favoritos e sacola são salvos apenas neste navegador.';form.querySelectorAll('input,button').forEach(el=>el.disabled=true);$('#resetPassword').disabled=true;message('Para ativar contas reais, siga o arquivo CONFIGURAR-FIREBASE.md.')}
else{
 try{
  const [{initializeApp},{getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,updateProfile,sendPasswordResetEmail,signOut},{getFirestore,doc,getDoc,setDoc}] = await Promise.all([
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);notice.hidden=true;store.setReady(false);
  const userDoc=user=>doc(db,'users',user.uid);
  function saveCloud(data){const user=activeUser;const token=session;if(!user)return;saveQueue=saveQueue.then(async()=>{if(activeUser?.uid!==user.uid||session!==token)return;await setDoc(userDoc(user),{favorites:data.favorites,cart:data.cart},{merge:true})}).catch(()=>message('Não foi possível sincronizar suas alterações. Verifique sua conexão.'));}
  onAuthStateChanged(auth,async user=>{session++;const token=session;store.setReady(false);activeUser=null;store.setAccount(null,null);showUser(user);if(!user){store.resetGuest();store.setReady(true);message('');return}try{await saveQueue;const snap=await getDoc(userDoc(user));if(token!==session)return;store.setState(snap.exists()?snap.data():{favorites:[],cart:[]});activeUser=user;store.setAccount(user,saveCloud);message('Favoritos e sacola sincronizados com sua conta.')}catch(e){console.error(e);if(token!==session)return;store.setState({favorites:[],cart:[]});message('Não foi possível carregar os dados da conta. Confira as regras do Firestore.');}});
  form.addEventListener('submit',async e=>{e.preventDefault();const email=$('#authEmail').value.trim(),password=$('#authPassword').value;const button=$('#authSubmit');button.disabled=true;message('Aguarde...');try{if(mode==='register'){const result=await createUserWithEmailAndPassword(auth,email,password);const name=$('#authName').value.trim();if(name)await updateProfile(result.user,{displayName:name});showUser({...result.user,displayName:name});message('Conta criada! Seus favoritos e sua sacola serão associados a este perfil.')}else{await signInWithEmailAndPassword(auth,email,password);message('Login realizado. Carregando seus dados...')}form.reset()}catch(error){message(friendly(error))}finally{button.disabled=false}});
  $('#resetPassword').addEventListener('click',async()=>{const email=$('#authEmail').value.trim();if(!email){message('Digite seu e-mail para recuperar a senha.');return}try{await sendPasswordResetEmail(auth,email);message('Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.')}catch(error){message(friendly(error))}});
  $('#logoutButton').addEventListener('click',async()=>{store.setReady(false);try{await saveQueue;await signOut(auth);message('Você saiu da conta.')}catch(error){message(friendly(error));store.setReady(true)}});
 }catch(error){console.error('Erro ao iniciar Firebase:',error);notice.hidden=false;notice.textContent='Não foi possível conectar ao Firebase. Confira a configuração e abra o site por HTTPS ou Live Server.';form.querySelectorAll('input,button').forEach(el=>el.disabled=true);store.setReady(true)}
}
