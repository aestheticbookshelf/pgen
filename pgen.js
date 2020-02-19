const path = require('path')
const jsonfile = require('jsonfile')
const fs = require('fs')
const rimraf = require('rimraf')
const { execSync } = require('child_process')

console.log()

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

jsonfile.readFile('conf.json').then(obj => {
    let make = obj.make
    let root = path.join(__dirname, obj.common.rootDirRel || "../", make)
    console.log("making", make)    
    try{fs.mkdirSync(root);console.log("created", root)}catch(err){console.log(root, "already exists")}
    let props = {...obj.common, ...obj.packages[make]}
    props.repo = make
    props.main = props.main || `${props.repo}.js`
    props.srcDir = props.srcDir || "src"
    props.mainPath = `${props.srcDir}/${props.main}`

    console.log("writing .gitignore")
    fs.writeFileSync(path.join(root, ".gitignore"), `\nnode_modules\n`)
    console.log("writing config")
    fs.writeFileSync(path.join(root, "config"), createConfig(props))
    console.log("removing git")
    rimraf.sync(path.join(root, ".git"))
    if(!props.skipGitInit){
        console.log("initializing git")
        execSync('git init', {
            cwd: root
        })
    }    
    console.log("writing config")
    fs.copyFileSync(path.join(root, "config"), path.join(root, ".git/config"))    
    console.log("writing package.json")
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(createPackageJson(props), null, 2))
    console.log("writing LICENSE")
    fs.copyFileSync(path.join(__dirname, "LICENSE"), path.join(root, "LICENSE"))    
    let sRootSrc = path.join(__dirname, "s")
    let sRoot = path.join(root, "s")
    console.log("writing scripts")
    try{fs.mkdirSync(sRoot);console.log("created", sRoot)}catch(err){console.log(sRoot, "already exists")}    
    fs.copyFileSync(path.join(sRootSrc, "init.bat"), path.join(sRoot, "init.bat"))    
    fs.copyFileSync(path.join(sRootSrc, "c.bat"), path.join(sRoot, "c.bat"))    
    fs.copyFileSync(path.join(sRootSrc, "p.bat"), path.join(sRoot, "p.bat"))   
    fs.copyFileSync(path.join(sRootSrc, "publish.bat"), path.join(sRoot, "publish.bat"))   
    console.log("creating src")    
    if(props.srcDir != ".") try{fs.mkdirSync(path.join(root, props.srcDir));console.log("created", props.srcDir)}catch(err){console.log(props.srcDir, "already exists")}    
    fs.writeFileSync(path.join(root, props.mainPath), "")
    console.log("writing ReadMe")    
    fs.writeFileSync(path.join(root, "ReadMe.md"), createReadMe(props))
})
