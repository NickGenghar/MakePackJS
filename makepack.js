const os = require('os');
const fs = require('fs-extra');
const readline = require('readline-sync');
const uuid = require('uuid');
const Zip = require('adm-zip');

let errorCode = 0;

const errorHandler = () => {
    switch(errorCode) {
        case(0): {
            console.log('No error occured throughout the process.');
        } break;
        case(1): {
            console.log('An error occured during initialization of working directory.');
        } break;
        case(2): {
            console.log('An error occured during format version selection.');
        } break;
        case(3): {
            console.log('An error occured during header creation.');
        } break;
        case(4): {
            console.log('An error occured during module creation.');
        } break;
        case(10): {
            console.log('An error occured during manifest saving.');
        } break;
        case(11): {
            console.log('An error occured during archive creation.');
        } break;
        case(12): {
            console.log('An error occured during content retrieval for archiving.');
        } break;
        case(21): {
            console.log('An error occured during Minecraft directory lookup.');
        } break;
        case(22): {
            console.log('An error occured caused by Minecraft directory not exist.');
        } break;
        case(23): {
            console.log('An error occured during pack type determining process.');
        } break;
        case(24): {
            console.log('An error occured caused by pack already existed in Minecraft directory.');
        } break;
        case(25): {
            console.log('An error occured during pack deployment.');
        } break;
        default: console.log('An unknown error has occured.');
    }

    console.log(`Process exited with code: ${errorCode}`);
    return process.exit(errorCode);
}

const redo = () => {
    return readline.keyInYNStrict('Do you want to redo the process?\n');
}

const workingDir = () => {
    let workDir = '';
    do {
        workDir = readline.question('Insert working directory here:\n');
        if(workDir.length > 0) {
            try {
                fs.accessSync(`${workDir}`);
            } catch {
                errorCode = 1
                if(readline.keyInYNStrict('Directory doesn\'t exist or invalid. Would you like to create the directory?\n')) {
                    errorCode = 0;
                    try {
                        fs.mkdirSync(workDir);
                    } catch {
                        errorCode = 1;
                        console.log('Failed to create the directory.');
                    }
                };
            }
        } else {
            errorCode = 1;
            console.log('Directory not specified. Please specify a valid directory.');
        }

        if(errorCode != 0) {
            if(!redo()) {
                errorHandler();
                break;
            } else {
                errorCode = 0;
                continue;
            }
        } else break;
    } while(true);

    console.log(`\nThe following directory has been set as the working directory:\n${workDir}`);
    errorCode = 0;
    return workDir;
}

const modeSelect = () => {
    let flag = 0;
    const menu = [
        'Create manifest.',
        'Export MCPACK.',
        'Deploy pack for testing.',
        'Reselect working directory.'
    ]
    flag = readline.keyInSelect(menu, 'Choose Mode:\n');
    return flag;
}

const initManifest = (manifest) => {
    do {
        manifest['format_version'] = readline.keyInSelect(['Format version 1 (<1.13). Warning, deprecated.','Format version 2 ( >=1.14). Prefered.'], 'Choose your format version:\n') + 1;
        if(manifest['format_version'] <= 0) {
            errorCode = 2;
            console.log('Specified format version is unknown or invalid. Please specify a valid format version.');

            if(!redo()) {
                errorHandler();
                break;
            }
        } else {
            break;
        }
    } while(true);
    errorCode = 0;
}

const initHeader = (manifest) => {
    const header = {};
    header['name'] = '',
    header['description'] = '',
    header['uuid'] = uuid.v4();

    do {
        header['name'] = readline.question('Pack name:\n');
        if(header['name'].length <= 0) {
            errorCode = 3;
            console.log('No name specified. Please specify a valid name.');

            if(!redo()) {
                errorHandler();
                break;
            }
        } else break;
    } while(true);

    do {
        header['description'] = readline.question('Pack description:\n');
        if(header['description'].length <= 0) {
            errorCode = 3;
            console.log('No description specified. Please specify a valid description.');

            if(!redo()) {
                errorHandler();
                break;
            }
        } else break;
    } while(true);

    do {
        header['version'] = readline.question('Pack version [Default: 1.0.0]:\n', {defaultInput: '1.0.0'});
        header['version'] = header['version'].split('.');

        header['version'].forEach((t,n) => {
            header['version'][n] = parseInt(t);
        });

        if(!Array.isArray(header['version']) || header['version'].length != 3) {
            errorCode = 3;
            console.log('Version number inputted is invalid. Please specify a valid version number.');

            if(!redo()) {
                errorHandler();
                break;
            }
        } else break;
    } while(true);

    do {
        let minVer = '';
        switch(manifest['format_version']) {
            case(1): {minVer = '1.13.0'} break;
            case(2): {minVer = '1.16.0'} break;
            default: {minVer = '1.0.0'}
        }

        header['min_engine_version'] = readline.question('Pack minimum engine version\n[Default: 1.16.0 for format version 2 and 1.13.0 for format version 1]:\n', {defaultInput: minVer});
        header['min_engine_version'] = header['min_engine_version'].split('.');

        header['min_engine_version'].forEach((t,n) => {
            header['min_engine_version'][n] = parseInt(t);
        });

        if(!Array.isArray(header['min_engine_version']) || header['min_engine_version'].length != 3) {
            errorCode = 3;
            console.log('Minimum engine version number inputted is invalid. Please specify a valid minimum engine version number.');

            if(!redo()) {
                errorHandler();
                break;
            }
        } else if(manifest['format_version'] > 1 && header['min_engine_version'][1] <= 13) {
            errorCode = 3;
            console.log('Minimum engine version not supported by specified format version. Please specify a valid minimum engine version number supported by the chosen format version.');

            if(!redo()) {
                errorHandler();
                break;
            }
        } else break;
    } while(true);

    manifest['header'] = header;
    errorCode = 0;
}

const initModule = (manifest) => {
    let modules = [];
    let types = [
        'Resource Pack',
        'Behavior Pack',
        'Skin Pack'
    ];
    if(readline.keyInYNStrict('Add new module?\n')) {
        do {
            let items = {};
            items['uuid'] = uuid.v4();
            items['description'] = readline.question('Module description [Default: Follow header description]:\n',{defaultInput: manifest['header'].description});

            do {
                items['version'] = readline.question('Module version [Default: Follow header version]',{defaultInput: manifest['header'].version.join('.')}).split('.');
                items['version'].forEach((t,n) => {
                    items['version'][n] = parseInt(t);
                });
    
                if(!Array.isArray(items['version']) || items['version'].length != 3) {
                    errorCode = 4;
                    console.log('Module version invalid. Please specify a valid module version.');

                    if(!redo()) {
                        errorHandler();
                        break;
                    } else continue;
                } else break;
            } while(true);

            do {
                let opt = readline.keyInSelect(types, 'Module type:\n');

                //if-else because we're in a loop and switch-case takes precedence for breaks.
                if(opt == 0) {items['type'] = 'resources'; break;}
                else if(opt == 1) {items['type'] = 'data'; break;}
                else if(opt == 2) {items['type'] = 'skin_pack'; break;}
                else {
                    errorCode = 4;
                    console.log('Module type unknown or invalid. Please specify a valid module type.');

                    if(!redo()) {
                        errorHandler();
                        break;
                    } else break;
                }
            } while(true);

            errorCode = 0;
            modules.push(items);
            console.log('Module added.');

            if(readline.keyInYNStrict('Add new module?\n')) {
                continue;
            } else break;
        } while(true);
    }

    manifest['modules'] = modules;
    errorCode = 0;
}

const buildManifest = (workDir, manifest) => {
    try {
        if(workDir[-1] == '/') fs.writeFileSync(`${workDir}manifest.json`, JSON.stringify(manifest, {}, '\t'));
        else fs.writeFileSync(`${workDir}/manifest.json`, JSON.stringify(manifest, {}, '\t'));

        console.log('Manifest successfully generated.');
    } catch {
        errorCode = 10;
        console.log('Error. Failed to create manifest at directory.');
        if(!redo()) {
            return;
        } else {
            Create(workDir);
        }
    }
}

const Create = (workDir) => {
    const manifest = {}
    initManifest(manifest);
    initHeader(manifest);
    initModule(manifest);
    buildManifest(workDir, manifest);
}

const Export = (workDir) => {
    let content;
    try {
        content = JSON.parse(fs.readFileSync(`${workDir}/manifest.json`)).header.name;
        let zip = new Zip();
        try {
            zip.addLocalFolder(workDir);
            zip.writeZip(`${workDir}/${content}.zip`);
            console.log('Archive successfully created.');
        } catch {
            errorCode = 11;
            console.log('Failed to create archive. Please specify a working directory to the correct directory.');
        }
    } catch {
        errorCode = 12;
        console.log('Error. Failed to obtain content of manifest.json within working directory. Please specify a working directory containing a valid manifest.json file.');
    }
}

const getMinecraftDir = () => {
    let user = os.homedir();
    let deployDir;
    switch(os.platform()) {
        case('win32'): {
            deployDir = `${user}/AppData/Local/Package/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang`
        } break;
        case('linux'): {
            deployDir = `${user}/.local/share/mcpelauncher/games/com.mojang`
        } break;
        case('android'): {
            deployDir = `/storage/emulated/0/games/com.mojang`
        } break;
        default: {
            errorCode = 21;
            console.log('Error. Failed to determine Minecraft directory. Your current platform may not be supported.');
            return;
        }
    }

    try{
        fs.accessSync(deployDir);
    } catch {
        errorCode = 22;
        console.log('Error. Minecraft directory doesn\'t exist. Please make sure you have installed Minecraft and the directory has been generated.');
        return;
    }

    return deployDir;
}

const getPackTypeAndName = (workDir) => {
    let retrieved = JSON.parse(fs.readFileSync(`${workDir}/manifest.json`));

    let type, name = retrieved.header.name;
    let moduleList = retrieved.modules;

    if(moduleList.length > 1) {
        let availableModules = [];
        moduleList.forEach((i,n) => {
            availableModules.push(`Module ${n}: ${i.type}`);
        });

        type = moduleList[readline.keyInSelect(availableModules, 'Multiple modules detected. Please select the desired deployment type.\n')].type;
    } else type = moduleList[0].type;

    switch(type) {
        case('resources'): type = 'resource_packs'; break;
        case('data'): type = 'behavior_packs'; break;
        case('skin_pack'): type = 'skin_packs'; break;
        default: {
            errorCode = 23;
            if(readline.keyInYNStrict('Error. Failed to determine pack type. Would you like to specify the type of the pack?')) {
                type = getCustomPackType();
            } else return;
        }
    }

    return [type, name];
}

const getCustomPackType = () => {
    const types = [
        'Resource',
        'Behavior',
        'Skin Pack'
    ];

    const type = [
        'resource_packs',
        'behavior_packs',
        'skin_packs'
    ];

    return type[readline.keyInSelect(types, 'Choose pack type:\n')];
}

const startDeployment = (workDir, deployDir, packType, packName) => {
    try {
        fs.accessSync(`${deployDir}/${packType}/${packName}`);
        errorCode = 24;
        if(readline.keyInYNStrict('Error. Pack exists in target directory. Delete?\n')) {
            try {
                fs.copySync(workDir, `${deployDir}/${packType}/${packName}`);
                errorCode = 0;
            } catch {
                errorCode = 25;
                console.log('Error. Failed to replace target pack.');
                return;
            }
        }
    } catch {
        try {
            fs.copySync(workDir, `${deployDir}/${packType}/${packName}`);
        } catch(e) {
            console.log(e);
            errorCode = 25;
            console.log('Error. Failed to deploy target pack.');
            if(!redo()) {
                return;
            } else Deploy(workDir);
        }
    }
}

const Deploy = (workDir) => {
    const deployDir = getMinecraftDir();
    const packData = getPackTypeAndName(workDir);

    startDeployment(workDir, deployDir, packData[0], packData[1]);
    return;
}

(() => {
    let workDir = workingDir();
    let flag = true;
    do {
        let mode = modeSelect();

        switch(mode) {
            case(0): {
                Create(workDir);
            } break;
            case(1): {
                Export(workDir);
            } break;
            case(2): {
                Deploy(workDir);
            } break;
            case(3): {
                workDir = workingDir();
            } break;
            default: {
                if(!redo()) {
                    errorHandler();
                    flag = false;
                }
            }
        }
    } while(flag);

    errorHandler();
})();