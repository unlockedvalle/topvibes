const express=require('express'),mongoose=require('mongoose'),cors=require('cors'),{Octokit}=require('@octokit/rest'),fs=require('fs'),path=require('path');
const app=express();app.use(cors());app.use(express.json({limit:'10mb'}));
const PORT=process.env.PORT||3000;
const octokit=new Octokit({auth:process.env.GITHUB_TOKEN});
const OWNER=process.env.GITHUB_OWNER,REPO=process.env.GITHUB_REPO,BRANCH='main',FILE_PATH='index.html';
mongoose.connect(process.env.MONGO_URL);
const siteSchema=new mongoose.Schema({hero:{title:String,desc:String},about:{title:String,desc1:String,desc2:String},telegram:{title:String,desc:String,link:String},shirtsTitle:String,shirts:[{id:String,name:String,price:String,oldPrice:String,img:String,desc:String,vinted1:String,vinted2:String,wallapop:String,photos:[String],size:String,pdf:String}],discounts:{oldPrice:String,newPrice:String,validCodes:[String],title:String,desc:String},footer:{year:String,ig:String,tt:String,yt:String}},{collection:'site_data'});
const SiteData=mongoose.model('SiteData',siteSchema);
const template=fs.readFileSync(path.join(__dirname,'template.html'),'utf-8');
function generateHTML(d){let h=template;const r=(k,v)=>{h=h.replace(new RegExp(`{{${k}}}`, 'g'), v||'');};r('HERO_TITLE',d.hero?.title);r('HERO_DESC',d.hero?.desc);r('ABOUT_TITLE',d.about?.title);r('ABOUT_DESC1',d.about?.desc1);r('ABOUT_DESC2',d.about?.desc2);r('TELEGRAM_TITLE',d.telegram?.title);r('TELEGRAM_DESC',d.telegram?.desc);r('TELEGRAM_LINK',d.telegram?.link);r('SHIRTS_TITLE',d.shirtsTitle);r('SHIRTS_DATA',JSON.stringify(d.shirts||[]));r('VALID_CODES',JSON.stringify(d.discounts?.validCodes||[]));r('NEW_PRICE',d.discounts?.newPrice);r('COPYRIGHT_YEAR',d.footer?.year);r('IG_LINK',d.footer?.ig);r('TT_LINK',d.footer?.tt);r('YT_LINK',d.footer?.yt);return h;}
async function deploy(h){try{const {data}=await octokit.repos.getContent({owner:OWNER,repo:REPO,path:FILE_PATH,branch:BRANCH});await octokit.repos.createOrUpdateFileContents({owner:OWNER,repo:REPO,path:FILE_PATH,message:'Update site',content:Buffer.from(h).toString('base64'),sha:data.sha,branch:BRANCH});}catch(e){if(e.status===404){await octokit.repos.createOrUpdateFileContents({owner:OWNER,repo:REPO,path:FILE_PATH,message:'Create index.html',content:Buffer.from(h).toString('base64'),branch:BRANCH});}}}
async function init(){const c=await SiteData.countDocuments();if(c===0){const init={hero:{title:'DROP #003',desc:'Camisetas únicas'},about:{title:'TOPVIBES',desc1:'Marca de drops',desc2:'Fútbol, música, streetwear'},telegram:{title:'Únete a Telegram',desc:'Novedades',link:'https://t.me/topvibes'},shirtsTitle:'Camisetas',shirts:[{id:'test',name:'Test',price:'19.99',oldPrice:'24.99',img:'https://files.catbox.moe/c5tx02.jpg',desc:'Prueba',vinted1:'#',vinted2:'#',wallapop:'#',photos:[],size:'M',pdf:'#'}],discounts:{oldPrice:'24.99',newPrice:'19.99',validCodes:['TEST'],title:'Código',desc:'Prueba'},footer:{year:'2025',ig:'#',tt:'#',yt:'#'}};await new SiteData(init).save();await deploy(generateHTML(init));}}
app.get('/api/data',async(r,s)=>{const d=await SiteData.findOne();s.json(d||{});});
async function updateAndDeploy(field,value,res){await SiteData.updateOne({},{ $set: field?{[field]:value}:{shirtsTitle:value.shirtsTitle,shirts:value.shirts} },{upsert:true});const data=await SiteData.findOne();await deploy(generateHTML(data));res.json({status:'ok'});}
app.post('/api/update-hero',(req,res)=>updateAndDeploy('hero',req.body.hero,res));
app.post('/api/update-about',(req,res)=>updateAndDeploy('about',req.body.about,res));
app.post('/api/update-telegram',(req,res)=>updateAndDeploy('telegram',req.body.telegram,res));
app.post('/api/update-shirts',(req,res)=>updateAndDeploy(null,req.body,res));
app.post('/api/update-discounts',(req,res)=>updateAndDeploy('discounts',req.body.discounts,res));
app.post('/api/update-footer',(req,res)=>updateAndDeploy('footer',req.body.footer,res));
app.listen(PORT,()=>{init();console.log('Backend en '+PORT);});
