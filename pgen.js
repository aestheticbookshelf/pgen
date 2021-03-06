const path = require('path')
const fs = require('fs')
const fu = require('@aestheticbookshelf/fileutils')
const { execSync } = require('child_process')
const { Octokit } = require("@octokit/rest")

const SKIP_GIT = false

const APP_COPY_FROM_ROOT = [
    ".babelrc",
    "Procfile",
    "startserver.sh",
    "gulpfile.babel.js"
]

const octokit = Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: "Pgen"
})

function createConfig(props){
    let config = `[core]
	repositoryformatversion = 0
	filemode = false
	bare = false
	logallrefupdates = true
	symlinks = false
	ignorecase = true
	hideDotFiles = dotGitOnly
[remote "github"]
	url = https://github.com/${props.gitHubUser}/${props.repo}.git
	fetch = +refs/heads/*:refs/remotes/github/*
[user]
	name = ${props.gitHubUser}
	email = ${props.gitHubUserMail}
	[credential "https://github.com/${props.gitHubUser}/${props.repo}.git"]
		username = ${props.gitHubUser}
`

    if(props.app) config += `[remote "heroku"]
	url = https://git.heroku.com/${props.app}.git
	fetch = +refs/heads/*:refs/remotes/heroku/*
`

    return config
}

function createPackageJson(props){
    let pkgJson = {
        name: `@${props.npmUser}/${props.repo}`,
        version: `1.0.1`,
        description: props.description,
        main: props.mainPath,
        scripts: {"test": "echo \"Error: no test specified\" && exit 1"},
        keywords: props.keywords,
        author: props.gitHubUser,
        license: props.license || "MIT",
        homepage: `https://github.com/${props.gitHubUser}/${props.repo}`,
        bugs: {
            url: `https://github.com/${props.gitHubUser}/${props.repo}/issues`,
            email: props.gitHubUserMail
        },
        repository: {
            type: "git",
            url: `https://github.com/${props.gitHubUser}/${props.repo}.git`
        },
        dependencies: {},
    }

    return pkgJson
}

function createReadMe(props){
    let ReadMe = `# ${props.repo}

${props.description}
`

    return ReadMe
}

function getProps(){
    let obj = fu.readJson('conf.json')

    let make = obj.make
    let root = path.join(__dirname, obj.common.rootDirRel || "../", make)    
    let props = {...obj.common, ...obj.packages[make]}
    props.repo = make
    props.main = props.main || `${props.repo}.js`
    props.libDir = props.libDir || "lib"
    props.mainPath = `${props.libDir}/${props.main}`
    props.root = root

    return props
}

function createGitignore(props){
    let gitignore = `
node_modules
`

    if(props.firebase) gitignore += `
/env/*
!/env/ReadMe.md    
`

    return gitignore
}

function createInstallBat(props){    
    let ib = fu.readFile(path.join(__dirname, "s/install.bat")) + "\n"

    if(props.firebase){
        ib += "\ncall npm install @aestheticbookshelf/confutils\n"
    }

    if(props.oauth){
        ib += "\ncall npm install @aestheticbookshelf/oauth\n"
    }

    return ib
}

function createServer(props){
    let s = fu.readFile(path.join(__dirname, "resources/server/server.js"))

    if(props.firebase) s = s.replace("// firebase slot", `
const cu = require('@aestheticbookshelf/confutils')
const fa = cu.FirebaseAdmin({
    envDir: path.join(__rootdirname, "env"),
    storageBucket: "pgneditor-1ab96.appspot.com",
    databaseURL: "https://pgneditor-1ab96.firebaseio.com/"
})
`)

    if(props.oauth) s = s.replace("// oauth slot", `
const oauth = require('@aestheticbookshelf/oauth')

const firestore = ${props.firebase ? "fa.firestore" : "null"}

const maxAge = 31 * 24 * 60 * 60 * 1000

oauth.initOauth(app, firestore, maxAge)

oauth.addLichessStrategy(app, {
    tag: "lichess-common",
    clientID: process.env.LICHESS_CLIENT_ID,
    clientSecret: process.env.LICHESS_CLIENT_SECRET,
    authURL: "/auth/lichess",
    failureRedirect: "/?lichesslogin=failed",
    okRedirect: "/?lichesslogin=ok"
})

oauth.addLichessStrategy(app, {
    tag: "lichess-bot",
    clientID: process.env.LICHESS_BOT_CLIENT_ID,
    clientSecret: process.env.LICHESS_BOT_CLIENT_SECRET,
    authURL: "/auth/lichess/bot",
    scope: "challenge:read challenge:write bot:play",
    failureRedirect: "/?lichessbotlogin=failed",
    okRedirect: "/?lichessbotlogin=ok"
})
`)

    return s
}

function createStartServerBat(props){
    let node = props.node || "node"

    let makeenv = props.firebase ? `call s\\makeenv.bat\n\n` : ""

    let s = `
${makeenv}

start ${node} resources\\server\\server.js
`

    return s
}

function pgen(){
    let props = getProps()    
    console.log("making", props.repo)        
    console.log("initializing repo folder")
    let root = props.root
    fu.removeDir(root)
    fu.createDir(root)
    console.log("writing .gitignore")
    fu.writeFile(path.join(root, ".gitignore"), createGitignore(props))
    if(props.firebase){
        fu.createDir(path.join(root, "env"))
        fu.writeFile(path.join(root, "env/ReadMe.md"), "env")
        fs.copyFileSync(path.join(__dirname, "initenv.js"), path.join(root, "initenv.js"))    
    }
    console.log("writing config")
    fu.writeFile(path.join(root, "config"), createConfig(props))       
    console.log("removing git")        

    let p = SKIP_GIT ?
        new Promise(r=>{console.log("skip remove git");r()})
    :
        new Promise(r => octokit.repos.delete({
            owner: props.gitHubUser,
            repo: props.repo
        }).then(_ => {console.log("deleted repo");r()}, _ => {"could not delete repo";r()}))
    
    p.then(_ => (SKIP_GIT ? new Promise(r=>{console.log("skip create git");r()}) :                 
        octokit.repos.createForAuthenticatedUser({
            name: props.repo,
            description: props.description
        })).then(_ => {                        
            execSync('git init', {
                cwd: root
            })
            console.log("writing config")
            fs.copyFileSync(path.join(root, "config"), path.join(root, ".git/config"))    
            console.log("writing package.json")
            fu.writeFile(path.join(root, "package.json"), JSON.stringify(createPackageJson(props), null, 2))
            console.log("writing LICENSE")
            fs.copyFileSync(path.join(__dirname, "LICENSE"), path.join(root, "LICENSE"))    
            let sRootSrc = path.join(__dirname, "s")
            let sRoot = path.join(root, "s")
            console.log("writing scripts")
            fu.createDir(sRoot)
            fs.copyFileSync(path.join(sRootSrc, "init.bat"), path.join(sRoot, "init.bat"))    
            fs.copyFileSync(path.join(sRootSrc, "c.bat"), path.join(sRoot, "c.bat"))    
            if(props.app) fs.copyFileSync(path.join(sRootSrc, "ph.bat"), path.join(sRoot, "p.bat"))   
            else fs.copyFileSync(path.join(sRootSrc, "p.bat"), path.join(sRoot, "p.bat"))   
            if(props.app){
                fu.writeFile(path.join(sRoot, "s.bat"), createStartServerBat(props))   
                fs.copyFileSync(path.join(sRootSrc, "dev.bat"), path.join(sRoot, "dev.bat"))   
                fu.writeFile(path.join(sRoot, "install.bat"), createInstallBat(props))   
            }
            if(!props.app){
                fs.copyFileSync(path.join(sRootSrc, "publish.bat"), path.join(sRoot, "publish.bat"))   
                console.log("creating lib")    
                if(props.libDir != ".") fu.createDir(path.join(root, props.libDir))
                fu.writeFile(path.join(root, props.mainPath), "")
            }
            console.log("writing ReadMe")    
            fu.writeFile(path.join(root, "ReadMe.md"), createReadMe(props))
            if(props.app){
                console.log("creating app")
                for(let name of APP_COPY_FROM_ROOT){
                    console.log("copying", name)
                    fs.copyFileSync(path.join(__dirname, name), path.join(root, name))   
                }
                console.log("copying resources")
                fu.copyDir(path.join(__dirname, "resources"), path.join(root, "resources"))
                fu.writeFile(path.join(root, "resources/server/server.js"), createServer(props))
                console.log("copying dist")
                fu.copyDir(path.join(__dirname, "dist"), path.join(root, "dist"))
                if(!SKIP_GIT){
                    const Heroku = require('heroku-client')
                    const heroku = new Heroku({ token: process.env.HEROKU_TOKEN })
                    console.log("deleting app", props.app);
                    (new Promise(r => heroku.delete('/apps/' + props.app).then(_ => r(), _ => r()))).then(_ => {            
                        console.log("creating app", props.app)
                        heroku.post('/apps', {body: {
                            name: props.app,
                            region: "eu",
                            stack: "heroku-18"
                        }}).then(result => {
                            console.log("created app", result)
                        }, err => {
                            console.log("could not create app", err)
                        })
                    })
                }
            }
        }, err => console.log(err))        
    , err => console.log(err))
}

pgen()