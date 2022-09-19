import lodashGet from 'lodash/get';
import React from 'react';
import PropTypes from 'prop-types';
import {withOnyx} from 'react-native-onyx';
import lodashFindLast from 'lodash/findLast';
import CONST from '../CONST';
import Banner from './Banner';
import withLocalize, {withLocalizePropTypes} from './withLocalize';
import compose from '../libs/compose';
import personalDetailsPropType from '../pages/personalDetailsPropType';
import ONYXKEYS from '../ONYXKEYS';
import * as ReportUtils from '../libs/ReportUtils';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: PropTypes.shape({
        /** Route specific parameters used on this screen */
        params: PropTypes.shape({
            /** The ID of the report this screen should display */
            reportID: PropTypes.string,
        }).isRequired,
    }).isRequired,

    /** The policy this report is attached to */
    policyID: PropTypes.string.isRequired,

    /** The policy this report is attached to */
    ownerEmail: PropTypes.string.isRequired,

    /** The policy this report is attached to */
    oldPolicyName: PropTypes.string.isRequired,

    /** Personal details of all users */
    personalDetails: PropTypes.objectOf(personalDetailsPropType).isRequired,

    /** The list of policies the user has access to. */
    policies: PropTypes.objectOf(PropTypes.shape({
        /** The name of the policy */
        name: PropTypes.string,
    })).isRequired,

    ...withLocalizePropTypes,
};

const defaultProps = {
};

const ArchivedReportFooter = React.memo((props) => {
    const archiveReason = lodashGet(props.reportClosedAction, 'originalMessage.reason', CONST.REPORT.ARCHIVE_REASON.DEFAULT);
    let displayName = lodashGet(props.personalDetails, `${props.ownerEmail}.displayName`, props.ownerEmail);
    const reportClosedAction = lodashFindLast(props.reportActions, action => action.actionName === CONST.REPORT.ACTIONS.TYPE.CLOSED) || {
        originalMessage: {
            reason: CONST.REPORT.ARCHIVE_REASON.DEFAULT,
        },
    };

    let oldDisplayName;
    if (archiveReason === CONST.REPORT.ARCHIVE_REASON.ACCOUNT_MERGED) {
        const newLogin = reportClosedAction.originalMessage.newLogin;
        const oldLogin = reportClosedAction.originalMessage.oldLogin;
        displayName = lodashGet(props.personalDetails, `${newLogin}.displayName`, newLogin);
        oldDisplayName = lodashGet(props.personalDetails, `${oldLogin}.displayName`, oldLogin);
    }

    return (
        <Banner
            text={props.translate(`reportArchiveReasons.${archiveReason}`, {
                displayName: `<strong>${displayName}</strong>`,
                oldDisplayName: `<strong>${oldDisplayName}</strong>`,
                policyName: `<strong>${ReportUtils.getPolicyName({policyID: props.policyID, oldPolicyName: props.oldPolicyName}, props.policies)}</strong>`,
            })}
            shouldRenderHTML={archiveReason !== CONST.REPORT.ARCHIVE_REASON.DEFAULT}
        />
    );
});

ArchivedReportFooter.propTypes = propTypes;
ArchivedReportFooter.defaultProps = defaultProps;
ArchivedReportFooter.displayName = 'ArchivedReportFooter';

export default compose(
    withLocalize,
    withOnyx({
        reportActions: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${route.params.reportID.toString()}`,
            canEvict: false,
        },
        personalDetails: {
            key: ONYXKEYS.PERSONAL_DETAILS,
        },
        policies: {
            key: ONYXKEYS.COLLECTION.POLICY,
        },
    }),
)(ArchivedReportFooter);
