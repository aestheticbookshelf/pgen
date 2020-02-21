const path = require('path')
const fs = require('fs')
const fu = require('@aestheticbookshelf/fileutils')
const { execSync } = require('child_process')
const { Octokit } = require("@octokit/rest")

const SKIP_GIT = true

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

function pgen(){
    let props = getProps()    
    console.log("making", props.repo)        
    console.log("initializing repo folder")
    let root = props.root
    fu.removeDir(root)
    fu.createDir(root)
    console.log("writing .gitignore")
    fu.writeFile(path.join(root, ".gitignore"), `\nnode_modules\n`)
    console.log("writing config")
    fu.writeFile(path.join(root, "config"), createConfig(props))       
    console.log("removing git");        
    (SKIP_GIT ? new Promise(r=>r()) : octokit.repos.delete({
        owner: props.gitHubUser,
        repo: props.repo
    })).then(_ => (SKIP_GIT ? new Promise(r=>r()) :                 
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
                fs.copyFileSync(path.join(sRootSrc, "s.bat"), path.join(sRoot, "s.bat"))    
                fs.copyFileSync(path.join(sRootSrc, "dev.bat"), path.join(sRoot, "dev.bat"))   
                fs.copyFileSync(path.join(sRootSrc, "install.bat"), path.join(sRoot, "install.bat"))   
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
                if(!SKIP_GIT){
                    const Heroku = require('heroku-client')
                    const heroku = new Heroku({ token: process.env.HEROKU_TOKEN })
                    console.log("deleting app")
                    heroku.delete('/apps/' + props.app).then(_ => {            
                        console.log("creating app")
                        heroku.post('/apps', {body: {
                            name: props.app,
                            region: "eu",
                            stack: "heroku-18"
                        }}).then(result => {
                            console.log("created app", result)
                        })
                    })
                }
            }
        }, err => console.log(err))        
    , err => console.log(err))
}

pgen()