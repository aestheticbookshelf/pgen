const path = require('path')
const jsonfile = require('jsonfile')
const fs = require('fs')

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

jsonfile.readFile('conf.json').then(obj => {
    let make = obj.make
    let root = path.join(__dirname, obj.common.rootDirRel, make)
    console.log("making", make)    
    try{fs.mkdirSync(root);console.log("created", root)}catch(err){console.log(root, "already exists")}
    let props = {...obj.common, ...obj[make]}
    console.log("writing .gitignore")
    fs.writeFileSync(path.join(root, ".gitignore"), `\nnode_modules\n`)
    console.log("writing config")
    fs.writeFileSync(path.join(root, "config"), createConfig({
        gitHubUser: props.gitHubUser,
        gitHubUserMail: props.gitHubUserMail,
        repo: make,
    }))
})
