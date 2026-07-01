const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const axios = require('axios')

async function validateSubscription() {
  let repoPrivate;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }

  const upstream = 'mavrosxristoforos/get-xml-info';
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';
  core.info('');
  core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info('\u001b[32m\u2713 Free for public repositories\u001b[0m');
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info('');
  if (repoPrivate === false) return;
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const body = { action: action || '' };
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body, { timeout: 3000 }
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`);
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
      process.exit(1);
    }
    core.info('Timeout or API not reachable. Continuing to next step.');
  }
}

async function run() {
  await validateSubscription();
  try {
    console.log('Welcome to Get-XML-Version.')

    var argv = require('minimist')(process.argv.slice(2));
    var xmlFile;
    if (typeof argv.f !== 'undefined') {
      xmlFile = argv.f;
    } else {
      const workspace = path.resolve(process.env.GITHUB_WORKSPACE);
      const resolved = path.resolve(workspace, core.getInput('xml-file', { required: true }));
      if (!resolved.startsWith(workspace + path.sep) && resolved !== workspace) {
        core.setFailed('xml-file must be within GITHUB_WORKSPACE');
        return;
      }
      xmlFile = resolved;
    }
    var xpathToSearch = (typeof argv.p !== 'undefined') ? argv.p : core.getInput('xpath', { required: true });
    var debug = (typeof argv.d !== 'undefined') ? true : false;
    var zeroNodesAction = (typeof argv.z !== 'undefined') ? argv.z : (core.getInput('zero-nodes-action', {required: false}) || 'error')

    var namespaces = (typeof argv.n !== 'undefined') ? argv.n : (core.getInput('namespaces', {required: false}) || null)

    console.log(`File to read: ${xmlFile}`);
    console.log(`XPath: ${xpathToSearch}`);
    console.log(`Zero Nodes Action: ${zeroNodesAction}`)

    console.log(`Namespaces: ${namespaces}`)

    var xpath = require('xpath'), dom = require('@xmldom/xmldom').DOMParser



    fs.readFile(xmlFile, 'utf8', function read(err, data) {
      if (err) {
        core.setFailed(err.message);
      }
      else {
        console.log('File was read successfully. Proceeding to parse DOM.');

        var doc = new dom().parseFromString(data, 'text/xml');
        if (debug) {
          console.log('Debug output: Document.');
          console.log(doc);
        }

        selector = xpath.select
        if (namespaces)
          selector=selector=xpath.useNamespaces(JSON.parse(namespaces));

        var nodes = selector(xpathToSearch, doc);
        if (debug) {
          console.log('Debug output: Nodes.');
          console.log(nodes);
        }

        console.log(`Found ${nodes.length} nodes.`);

        if (typeof(nodes) == 'string')
	    {
		    core.setOutput('info', nodes)
          console.log(`Output: ${nodes}`);
	    }
        else if (['silent','warn'].includes(zeroNodesAction) || nodes.length) {
          var output = [];
          for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var firstChild = node.firstChild;
            if (firstChild) {
              output.push(firstChild.data);
            } else {
              output.push(node.value);
            }
          }
          if ('warn' === zeroNodesAction && 0 === nodes.length) {
            console.warn("Zero Nodes Found");
            core.setOutput('info', "Zero Nodes Found.");
          } else {
            core.setOutput('info', String(output));
            console.log(`Output: ${output}`);
          }

        } else {
          console.error('Your xpath did not return any nodes.')
          core.setFailed('Your xpath did not return any nodes.');
        }
      }
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
