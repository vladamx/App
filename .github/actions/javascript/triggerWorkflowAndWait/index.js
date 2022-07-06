/**
 * NOTE: This is a compiled file. DO NOT directly edit this file.
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 910:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const _ = __nccwpck_require__(31);
const core = __nccwpck_require__(320);
const ActionUtils = __nccwpck_require__(890);
const GithubUtils = __nccwpck_require__(269);
const {promiseWhile} = __nccwpck_require__(58);

/**
 * The maximum amount of time (in ms) we'll wait for a new workflow to start after sending the workflow_dispatch event.
 * It's ten minutes :)
 * @type {number}
 */
const NEW_WORKFLOW_TIMEOUT = 600000;

/**
 * The maximum amount of time (in ms) we'll wait for a workflow to complete before giving up.
 * It's two hours :)
 * @type {number}
 */
const WORKFLOW_COMPLETION_TIMEOUT = 7200000;

/**
 * URL prefixed to a specific workflow run
 * @type {string}
 */
const WORKFLOW_RUN_URL_PREFIX = 'https://github.com/Expensify/App/actions/runs/';

const run = function () {
    const workflow = core.getInput('WORKFLOW', {required: true});
    const inputs = ActionUtils.getJSONInput('INPUTS', {required: false}, {});

    console.log('This action has received the following inputs: ', {workflow, inputs});

    if (_.keys(inputs).length > 10) {
        const err = new Error('Inputs to the workflow_dispatch event cannot have more than 10 keys, or GitHub will 🤮');
        console.error(err.message);
        core.setFailed(err);
        process.exit(1);
    }

    // GitHub's createWorkflowDispatch returns a 204 No Content, so we need to:
    // 1) Get the last workflow run
    // 2) Trigger a new workflow run
    // 3) Poll the API until a new one appears
    // 4) Then we can poll and wait for that new workflow run to conclude
    let previousWorkflowRunID;
    let newWorkflowRunID;
    let newWorkflowRunURL;
    let hasNewWorkflowStarted = false;
    let workflowCompleted = false;
    return GithubUtils.getLatestWorkflowRunID(workflow)
        .then((lastWorkflowRunID) => {
            console.log(`Latest ${workflow} workflow run has ID: ${lastWorkflowRunID}`);
            previousWorkflowRunID = lastWorkflowRunID;

            console.log(`Dispatching workflow: ${workflow}`);
            return GithubUtils.octokit.actions.createWorkflowDispatch({
                owner: GithubUtils.GITHUB_OWNER,
                repo: GithubUtils.APP_REPO,
                workflow_id: workflow,
                ref: 'main',
                inputs,
            });
        })

        .catch((err) => {
            console.error(`Failed to dispatch workflow ${workflow}`, err);
            core.setFailed(err);
            process.exit(1);
        })

        // Wait for the new workflow to start
        .then(() => {
            let waitTimer = -GithubUtils.POLL_RATE;
            return promiseWhile(
                () => !hasNewWorkflowStarted && waitTimer < NEW_WORKFLOW_TIMEOUT,
                _.throttle(
                    () => {
                        console.log(`\n🤚 Waiting for a new ${workflow} workflow run to begin...`);
                        return GithubUtils.getLatestWorkflowRunID(workflow)
                            .then((lastWorkflowRunID) => {
                                newWorkflowRunID = lastWorkflowRunID;
                                newWorkflowRunURL = WORKFLOW_RUN_URL_PREFIX + newWorkflowRunID;
                                hasNewWorkflowStarted = newWorkflowRunID !== previousWorkflowRunID;

                                if (!hasNewWorkflowStarted) {
                                    waitTimer += GithubUtils.POLL_RATE;
                                    if (waitTimer < NEW_WORKFLOW_TIMEOUT) {
                                        // eslint-disable-next-line max-len
                                        console.log(`After ${waitTimer / 1000} seconds, there's still no new ${workflow} workflow run 🙁`);
                                    } else {
                                        // eslint-disable-next-line max-len
                                        const err = new Error(`After ${NEW_WORKFLOW_TIMEOUT / 1000} seconds, the ${workflow} workflow did not start.`);
                                        console.error(err);
                                        core.setFailed(err);
                                        process.exit(1);
                                    }
                                } else {
                                    console.log(`\n🚀 New ${workflow} run ${newWorkflowRunURL} has started`);
                                }
                            })
                            .catch((err) => {
                                console.warn('Failed to fetch latest workflow run.', err);
                            });
                    },
                    GithubUtils.POLL_RATE,
                ),
            );
        })

        // Wait for the new workflow run to finish
        .then(() => {
            let waitTimer = -GithubUtils.POLL_RATE;
            return promiseWhile(
                () => !workflowCompleted && waitTimer < WORKFLOW_COMPLETION_TIMEOUT,
                _.throttle(
                    () => {
                        console.log(`\n⏳ Waiting for workflow run ${newWorkflowRunURL} to finish...`);
                        return GithubUtils.octokit.actions.getWorkflowRun({
                            owner: GithubUtils.GITHUB_OWNER,
                            repo: GithubUtils.APP_REPO,
                            run_id: newWorkflowRunID,
                        })
                            .then(({data}) => {
                                workflowCompleted = data.status === 'completed' && data.conclusion !== null;
                                waitTimer += GithubUtils.POLL_RATE;
                                if (waitTimer > WORKFLOW_COMPLETION_TIMEOUT) {
                                    // eslint-disable-next-line max-len
                                    const err = new Error(`After ${WORKFLOW_COMPLETION_TIMEOUT / 1000 / 60 / 60} hours, workflow ${newWorkflowRunURL} did not complete.`);
                                    console.error(err);
                                    core.setFailed(err);
                                    process.exit(1);
                                }
                                if (workflowCompleted) {
                                    if (data.conclusion === 'success') {
                                        // eslint-disable-next-line max-len
                                        console.log(`\n🎉 ${workflow} run ${newWorkflowRunURL} completed successfully! 🎉`);
                                    } else {
                                        // eslint-disable-next-line max-len
                                        const err = new Error(`🙅‍ ${workflow} run ${newWorkflowRunURL} finished with conclusion ${data.conclusion}`);
                                        console.error(err.message);
                                        core.setFailed(err);
                                        process.exit(1);
                                    }
                                }
                            });
                    },
                    GithubUtils.POLL_RATE,
                ),
            );
        });
};

if (require.main === require.cache[eval('__filename')]) {
    run();
}

module.exports = run;


/***/ }),

/***/ 890:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const core = __nccwpck_require__(320);

/**
 * Safely parse a JSON input to a GitHub Action.
 *
 * @param {String} name - The name of the input.
 * @param {Object} options - Options to pass to core.getInput
 * @param {*} [defaultValue] - A default value to provide for the input.
 *                             Not required if the {required: true} option is given in the second arg to this function.
 * @returns {any}
 */
function getJSONInput(name, options, defaultValue = undefined) {
    const input = core.getInput(name, options);
    if (input) {
        return JSON.parse(input);
    }
    return defaultValue;
}

/**
 * Safely access a string input to a GitHub Action, or fall back on a default if the string is empty.
 *
 * @param {String} name
 * @param {Object} options
 * @param {*} [defaultValue]
 * @returns {string|undefined}
 */
function getStringInput(name, options, defaultValue = undefined) {
    const input = core.getInput(name, options);
    if (!input) {
        return defaultValue;
    }
    return input;
}

module.exports = {
    getJSONInput,
    getStringInput,
};


/***/ }),

/***/ 269:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const _ = __nccwpck_require__(31);
const lodashGet = __nccwpck_require__(969);
const core = __nccwpck_require__(320);
const {GitHub, getOctokitOptions} = __nccwpck_require__(775);
const {throttling} = __nccwpck_require__(684);

const GITHUB_OWNER = 'Expensify';
const APP_REPO = 'App';
const APP_REPO_URL = 'https://github.com/Expensify/App';

const GITHUB_BASE_URL_REGEX = new RegExp('https?://(?:github\\.com|api\\.github\\.com)');
const PULL_REQUEST_REGEX = new RegExp(`${GITHUB_BASE_URL_REGEX.source}/.*/.*/pull/([0-9]+).*`);
const ISSUE_REGEX = new RegExp(`${GITHUB_BASE_URL_REGEX.source}/.*/.*/issues/([0-9]+).*`);
const ISSUE_OR_PULL_REQUEST_REGEX = new RegExp(`${GITHUB_BASE_URL_REGEX.source}/.*/.*/(?:pull|issues)/([0-9]+).*`);

const APPLAUSE_BOT = 'applausebot';
const STAGING_DEPLOY_CASH_LABEL = 'StagingDeployCash';
const DEPLOY_BLOCKER_CASH_LABEL = 'DeployBlockerCash';
const INTERNAL_QA_LABEL = 'InternalQA';

/**
 * The standard rate in ms at which we'll poll the GitHub API to check for status changes.
 * It's 10 seconds :)
 * @type {number}
 */
const POLL_RATE = 10000;

class GithubUtils {
    /**
     * Either give an existing instance of Octokit or create a new one
     *
     * @readonly
     * @static
     * @memberof GithubUtils
     */
    static get octokit() {
        if (this.octokitInternal) {
            return this.octokitInternal;
        }
        const OctokitThrottled = GitHub.plugin(throttling);
        const token = core.getInput('GITHUB_TOKEN', {required: true});
        this.octokitInternal = new OctokitThrottled(getOctokitOptions(token, {
            throttle: {
                onRateLimit: (retryAfter, options) => {
                    console.warn(
                        `Request quota exhausted for request ${options.method} ${options.url}`,
                    );

                    // Retry once after hitting a rate limit error, then give up
                    if (options.request.retryCount <= 1) {
                        console.log(`Retrying after ${retryAfter} seconds!`);
                        return true;
                    }
                },
                onAbuseLimit: (retryAfter, options) => {
                    // does not retry, only logs a warning
                    console.warn(
                        `Abuse detected for request ${options.method} ${options.url}`,
                    );
                },
            },
        }));
        return this.octokitInternal;
    }

    /**
     * Finds one open `StagingDeployCash` issue via GitHub octokit library.
     *
     * @returns {Promise}
     */
    static getStagingDeployCash() {
        return this.octokit.issues.listForRepo({
            owner: GITHUB_OWNER,
            repo: APP_REPO,
            labels: STAGING_DEPLOY_CASH_LABEL,
            state: 'open',
        })
            .then(({data}) => {
                if (!data.length) {
                    const error = new Error(`Unable to find ${STAGING_DEPLOY_CASH_LABEL} issue.`);
                    error.code = 404;
                    throw error;
                }

                if (data.length > 1) {
                    const error = new Error(`Found more than one ${STAGING_DEPLOY_CASH_LABEL} issue.`);
                    error.code = 500;
                    throw error;
                }

                return this.getStagingDeployCashData(data[0]);
            });
    }

    /**
     * Takes in a GitHub issue object and returns the data we want.
     *
     * @param {Object} issue
     * @returns {Object}
     */
    static getStagingDeployCashData(issue) {
        try {
            const versionRegex = new RegExp('([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9]+))?', 'g');
            const tag = issue.body.match(versionRegex)[0].replace(/`/g, '');
            return {
                title: issue.title,
                url: issue.url,
                number: this.getIssueOrPullRequestNumberFromURL(issue.url),
                labels: issue.labels,
                PRList: this.getStagingDeployCashPRList(issue),
                deployBlockers: this.getStagingDeployCashDeployBlockers(issue),
                isTimingDashboardChecked: /-\s\[x]\sI checked the \[App Timing Dashboard]/.test(issue.body),
                isFirebaseChecked: /-\s\[x]\sI checked \[Firebase Crashlytics]/.test(issue.body),
                tag,
            };
        } catch (exception) {
            throw new Error(`Unable to find ${STAGING_DEPLOY_CASH_LABEL} issue with correct data.`);
        }
    }

    /**
     * Parse the PRList and Internal QA section of the StagingDeployCash issue body.
     *
     * @private
     *
     * @param {Object} issue
     * @returns {Array<Object>} - [{url: String, number: Number, isVerified: Boolean}]
     */
    static getStagingDeployCashPRList(issue) {
        let PRListSection = issue.body.match(/pull requests:\*\*(?:\r?\n)*((?:.*\r?\n(?:\s+-\s.*\r?\n)+\r?\n)+)/) || [];
        if (PRListSection.length !== 2) {
            // No PRs, return an empty array
            console.log('Hmmm...The open StagingDeployCash does not list any pull requests, continuing...');
            return [];
        }
        PRListSection = PRListSection[1];
        const PRList = _.map(
            [...PRListSection.matchAll(new RegExp(`- (${PULL_REQUEST_REGEX.source})\\s+- \\[([ x])] QA\\s+- \\[([ x])] Accessibility`, 'g'))],
            match => ({
                url: match[1],
                number: Number.parseInt(match[2], 10),
                isVerified: match[3] === 'x',
                isAccessible: match[4] === 'x',
            }),
        );
        const internalQAPRList = this.getStagingDeployCashInternalQA(issue);
        return _.sortBy(_.union(PRList, internalQAPRList), 'number');
    }

    /**
     * Parse DeployBlocker section of the StagingDeployCash issue body.
     *
     * @private
     *
     * @param {Object} issue
     * @returns {Array<Object>} - [{URL: String, number: Number, isResolved: Boolean}]
     */
    static getStagingDeployCashDeployBlockers(issue) {
        let deployBlockerSection = issue.body.match(/Deploy Blockers:\*\*\r?\n((?:.*\r?\n)+)/) || [];
        if (deployBlockerSection.length !== 2) {
            return [];
        }
        deployBlockerSection = deployBlockerSection[1];
        const deployBlockers = _.map(
            [...deployBlockerSection.matchAll(new RegExp(`- \\[([ x])]\\s(${ISSUE_OR_PULL_REQUEST_REGEX.source})`, 'g'))],
            match => ({
                url: match[2],
                number: Number.parseInt(match[3], 10),
                isResolved: match[1] === 'x',
            }),
        );
        return _.sortBy(deployBlockers, 'number');
    }

    /**
     * Parse InternalQA section of the StagingDeployCash issue body.
     *
     * @private
     *
     * @param {Object} issue
     * @returns {Array<Object>} - [{URL: String, number: Number, isResolved: Boolean, isAccessible: Boolean}]
     */
    static getStagingDeployCashInternalQA(issue) {
        let internalQASection = issue.body.match(/Internal QA:\*\*\r?\n((?:- \[[ x]].*\r?\n)+)/) || [];
        if (internalQASection.length !== 2) {
            return [];
        }
        internalQASection = internalQASection[1];
        const internalQAPRs = _.map(
            [...internalQASection.matchAll(new RegExp(`- \\[([ x])]\\s(${PULL_REQUEST_REGEX.source})`, 'g'))],
            match => ({
                url: match[2],
                number: Number.parseInt(match[3], 10),
                isResolved: match[1] === 'x',
                isAccessible: false,
            }),
        );
        return _.sortBy(internalQAPRs, 'number');
    }

    /**
     * Generate the issue body for a StagingDeployCash.
     *
     * @param {String} tag
     * @param {Array} PRList - The list of PR URLs which are included in this StagingDeployCash
     * @param {Array} [verifiedPRList] - The list of PR URLs which have passed QA.
     * @param {Array} [accessiblePRList] - The list of PR URLs which have passed the accessability check.
     * @param {Array} [deployBlockers] - The list of DeployBlocker URLs.
     * @param {Array} [resolvedDeployBlockers] - The list of DeployBlockers URLs which have been resolved.
     * @param {Boolean} [isTimingDashboardChecked]
     * @param {Boolean} [isFirebaseChecked]
     * @returns {Promise}
     */
    static generateStagingDeployCashBody(
        tag,
        PRList,
        verifiedPRList = [],
        accessiblePRList = [],
        deployBlockers = [],
        resolvedDeployBlockers = [],
        isTimingDashboardChecked = false,
        isFirebaseChecked = false,
    ) {
        return this.fetchAllPullRequests(_.map(PRList, this.getPullRequestNumberFromURL))
            .then((data) => {
                const automatedPRs = _.pluck(
                    _.filter(data, GithubUtils.isAutomatedPullRequest),
                    'html_url',
                );
                console.log('Filtering out the following automated pull requests:', automatedPRs);

                const internalQAPRMap = _.reduce(
                    _.filter(data, pr => !_.isEmpty(_.findWhere(pr.labels, {name: INTERNAL_QA_LABEL}))),
                    (map, pr) => {
                        // eslint-disable-next-line no-param-reassign
                        map[pr.html_url] = _.compact(_.pluck(pr.assignees, 'login'));
                        return map;
                    },
                    {},
                );
                console.log('Found the following Internal QA PRs:', internalQAPRMap);

                const noQAPRs = _.pluck(
                    _.filter(data, PR => (PR.title || '').toUpperCase().startsWith('[NO QA]')),
                    'html_url',
                );
                console.log('Found the following NO QA PRs:', noQAPRs);
                const verifiedOrNoQAPRs = _.union(verifiedPRList, noQAPRs);
                const accessibleOrNoQAPRs = _.union(accessiblePRList, noQAPRs);

                const sortedPRList = _.chain(PRList)
                    .difference(automatedPRs)
                    .difference(_.keys(internalQAPRMap))
                    .unique()
                    .sortBy(GithubUtils.getPullRequestNumberFromURL)
                    .value();
                const sortedDeployBlockers = _.sortBy(
                    _.unique(deployBlockers),
                    GithubUtils.getIssueOrPullRequestNumberFromURL,
                );

                // Tag version and comparison URL
                // eslint-disable-next-line max-len
                let issueBody = `**Release Version:** \`${tag}\`\r\n**Compare Changes:** https://github.com/Expensify/App/compare/production...staging\r\n`;

                // PR list
                if (!_.isEmpty(sortedPRList)) {
                    issueBody += '\r\n**This release contains changes from the following pull requests:**';
                    _.each(sortedPRList, (URL) => {
                        issueBody += `\r\n\r\n- ${URL}`;
                        issueBody += _.contains(verifiedOrNoQAPRs, URL) ? '\r\n  - [x] QA' : '\r\n  - [ ] QA';
                        issueBody += _.contains(accessibleOrNoQAPRs, URL) ? '\r\n  - [x] Accessibility' : '\r\n  - [ ] Accessibility';
                    });
                }

                if (!_.isEmpty(internalQAPRMap)) {
                    issueBody += '\r\n\r\n\r\n**Internal QA:**';
                    _.each(internalQAPRMap, (assignees, URL) => {
                        const assigneeMentions = _.reduce(assignees, (memo, assignee) => `${memo} @${assignee}`, '');
                        issueBody += `\r\n${_.contains(verifiedOrNoQAPRs, URL) ? '- [x]' : '- [ ]'} `;
                        issueBody += `${URL}`;
                        issueBody += ` -${assigneeMentions}`;
                    });
                }

                // Deploy blockers
                if (!_.isEmpty(deployBlockers)) {
                    issueBody += '\r\n\r\n\r\n**Deploy Blockers:**';
                    _.each(sortedDeployBlockers, (URL) => {
                        issueBody += _.contains(resolvedDeployBlockers, URL) ? '\r\n- [x] ' : '\r\n- [ ] ';
                        issueBody += URL;
                    });
                }

                issueBody += '\r\n\r\n**Deployer verifications:**';
                // eslint-disable-next-line max-len
                issueBody += `\r\n- [${isTimingDashboardChecked ? 'x' : ' '}] I checked the [App Timing Dashboard](https://graphs.expensify.com/grafana/d/yj2EobAGz/app-timing?orgId=1) and verified this release does not cause a noticeable performance regression.`;
                // eslint-disable-next-line max-len
                issueBody += `\r\n- [${isFirebaseChecked ? 'x' : ' '}] I checked [Firebase Crashlytics](https://console.firebase.google.com/u/0/project/expensify-chat/crashlytics/app/android:com.expensify.chat/issues?state=open&time=last-seven-days&tag=all) and verified that this release does not introduce any new crashes.`;

                issueBody += '\r\n\r\ncc @Expensify/applauseleads\r\n';
                return issueBody;
            })
            .catch(err => console.warn(
                'Error generating StagingDeployCash issue body!',
                'Automated PRs may not be properly filtered out. Continuing...',
                err,
            ));
    }

    /**
     * Fetch all pull requests given a list of PR numbers.
     *
     * @param {Array<Number>} pullRequestNumbers
     * @returns {Promise}
     */
    static fetchAllPullRequests(pullRequestNumbers) {
        const oldestPR = _.first(_.sortBy(pullRequestNumbers));
        return this.octokit.paginate(this.octokit.pulls.list, {
            owner: GITHUB_OWNER,
            repo: APP_REPO,
            state: 'all',
            sort: 'created',
            direction: 'desc',
            per_page: 100,
        }, ({data}, done) => {
            if (_.find(data, pr => pr.number === oldestPR)) {
                done();
            }
            return data;
        })
            .then(prList => _.filter(prList, pr => _.contains(pullRequestNumbers, pr.number)))
            .catch(err => console.error('Failed to get PR list', err));
    }

    /**
     * Create comment on pull request
     *
     * @param {String} repo - The repo to search for a matching pull request or issue number
     * @param {Number} number - The pull request or issue number
     * @param {String} messageBody - The comment message
     * @returns {Promise}
     */
    static createComment(repo, number, messageBody) {
        console.log(`Writing comment on #${number}`);
        return this.octokit.issues.createComment({
            owner: GITHUB_OWNER,
            repo,
            issue_number: number,
            body: messageBody,
        });
    }

    /**
     * Get the most recent workflow run for the given New Expensify workflow.
     *
     * @param {String} workflow
     * @returns {Promise}
     */
    static getLatestWorkflowRunID(workflow) {
        console.log(`Fetching New Expensify workflow runs for ${workflow}...`);
        return this.octokit.actions.listWorkflowRuns({
            owner: GITHUB_OWNER,
            repo: APP_REPO,
            workflow_id: workflow,
        })
            .then(response => lodashGet(response, 'data.workflow_runs[0].id'));
    }

    /**
     * Generate the well-formatted body of a production release.
     *
     * @param {Array} pullRequests
     * @returns {String}
     */
    static getReleaseBody(pullRequests) {
        return _.map(
            pullRequests,
            number => `- ${this.getPullRequestURLFromNumber(number)}`,
        ).join('\r\n');
    }

    /**
     * Generate the URL of an New Expensify pull request given the PR number.
     *
     * @param {Number} number
     * @returns {String}
     */
    static getPullRequestURLFromNumber(number) {
        return `${APP_REPO_URL}/pull/${number}`;
    }

    /**
     * Parse the pull request number from a URL.
     *
     * @param {String} URL
     * @returns {Number}
     * @throws {Error} If the URL is not a valid Github Pull Request.
     */
    static getPullRequestNumberFromURL(URL) {
        const matches = URL.match(PULL_REQUEST_REGEX);
        if (!_.isArray(matches) || matches.length !== 2) {
            throw new Error(`Provided URL ${URL} is not a Github Pull Request!`);
        }
        return Number.parseInt(matches[1], 10);
    }

    /**
     * Parse the issue number from a URL.
     *
     * @param {String} URL
     * @returns {Number}
     * @throws {Error} If the URL is not a valid Github Issue.
     */
    static getIssueNumberFromURL(URL) {
        const matches = URL.match(ISSUE_REGEX);
        if (!_.isArray(matches) || matches.length !== 2) {
            throw new Error(`Provided URL ${URL} is not a Github Issue!`);
        }
        return Number.parseInt(matches[1], 10);
    }

    /**
     * Parse the issue or pull request number from a URL.
     *
     * @param {String} URL
     * @returns {Number}
     * @throws {Error} If the URL is not a valid Github Issue or Pull Request.
     */
    static getIssueOrPullRequestNumberFromURL(URL) {
        const matches = URL.match(ISSUE_OR_PULL_REQUEST_REGEX);
        if (!_.isArray(matches) || matches.length !== 2) {
            throw new Error(`Provided URL ${URL} is not a valid Github Issue or Pull Request!`);
        }
        return Number.parseInt(matches[1], 10);
    }

    /**
     * Determine if a given pull request is an automated PR.
     *
     * @param {Object} pullRequest
     * @returns {Boolean}
     */
    static isAutomatedPullRequest(pullRequest) {
        return _.isEqual(lodashGet(pullRequest, 'user.login', ''), 'OSBotify');
    }

    /**
     * Return the login of the actor who closed an issue or PR. If the issue is not closed, return an empty string.
     *
     * @param {Number} issueNumber
     * @returns {Promise<String>}
     */
    static getActorWhoClosedIssue(issueNumber) {
        return this.octokit.paginate(this.octokit.issues.listEvents, {
            owner: GITHUB_OWNER,
            repo: APP_REPO,
            issue_number: issueNumber,
            per_page: 100,
        })
            .then(events => _.filter(events, event => event.event === 'closed'))
            .then(closedEvents => lodashGet(_.last(closedEvents), 'actor.login', ''));
    }
}

module.exports = GithubUtils;
module.exports.GITHUB_OWNER = GITHUB_OWNER;
module.exports.APP_REPO = APP_REPO;
module.exports.STAGING_DEPLOY_CASH_LABEL = STAGING_DEPLOY_CASH_LABEL;
module.exports.DEPLOY_BLOCKER_CASH_LABEL = DEPLOY_BLOCKER_CASH_LABEL;
module.exports.APPLAUSE_BOT = APPLAUSE_BOT;
module.exports.ISSUE_OR_PULL_REQUEST_REGEX = ISSUE_OR_PULL_REQUEST_REGEX;
module.exports.POLL_RATE = POLL_RATE;


/***/ }),

/***/ 58:
/***/ ((module) => {

/**
 * Simulates a while loop where the condition is determined by the result of a Promise.
 *
 * @param {Function} condition
 * @param {Function} action
 * @returns {Promise}
 */
function promiseWhile(condition, action) {
    return new Promise((resolve, reject) => {
        const loop = function () {
            if (!condition()) {
                resolve();
            } else {
                Promise.resolve(action())
                    .then(loop)
                    .catch(reject);
            }
        };
        loop();
    });
}

/**
 * Simulates a do-while loop where the condition is determined by the result of a Promise.
 *
 * @param {Function} condition
 * @param {Function} action
 * @returns {Promise}
 */
function promiseDoWhile(condition, action) {
    return new Promise((resolve, reject) => {
        action()
            .then(() => promiseWhile(condition, action))
            .then(() => resolve())
            .catch(reject);
    });
}

module.exports = {
    promiseWhile,
    promiseDoWhile,
};


/***/ }),

/***/ 320:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 775:
/***/ ((module) => {

module.exports = eval("require")("@actions/github/lib/utils");


/***/ }),

/***/ 684:
/***/ ((module) => {

module.exports = eval("require")("@octokit/plugin-throttling");


/***/ }),

/***/ 969:
/***/ ((module) => {

module.exports = eval("require")("lodash/get");


/***/ }),

/***/ 31:
/***/ ((module) => {

module.exports = eval("require")("underscore");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(910);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
