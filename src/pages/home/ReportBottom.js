import React from 'react';
import {withOnyx} from 'react-native-onyx';
import PropTypes from 'prop-types';
import {Keyboard, View} from 'react-native';
import styles from '../../styles/styles';
import ONYXKEYS from '../../ONYXKEYS';
import * as ReportUtils from '../../libs/ReportUtils';
import ReportActionCompose from './report/ReportActionCompose';
import SwipeableView from '../../components/SwipeableView';
import CONST from '../../CONST';
import * as Report from '../../libs/actions/Report';
import ArchivedReportFooter from '../../components/ArchivedReportFooter';
import {withNetwork} from '../../components/OnyxProvider';
import compose from '../../libs/compose';
import networkPropTypes from '../../components/networkPropTypes';
import getReportID from './getReportID';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: PropTypes.shape({
        /** Route specific parameters used on this screen */
        params: PropTypes.shape({
            /** The ID of the report this screen should display */
            reportID: PropTypes.string,
        }).isRequired,
    }).isRequired,

    /** Chat type for the report */
    chatType: PropTypes.string.isRequired,

    /** Policy ID for the report */
    policyID: PropTypes.string.isRequired,

    /** Participants for the report */
    participants: PropTypes.arrayOf(PropTypes.string).isRequired,

    /** Owner email for the report */
    ownerEmail: PropTypes.string.isRequired,

    /** Status for report */
    statusNum: PropTypes.number.isRequired,

    /** State for report */
    stateNum: PropTypes.number.isRequired,

    /** Old policy name for report */
    oldPolicyName: PropTypes.string,

    /** Whether or not to show the Compose Input */
    session: PropTypes.shape({
        shouldShowComposeInput: PropTypes.bool,
    }),

    /** Information about the network */
    network: networkPropTypes.isRequired,

    /** Whether the composer is full size */
    isComposerFullSize: PropTypes.bool,
};

const defaultProps = {
    session: {
        shouldShowComposeInput: true,
    },
    isComposerFullSize: false,
    oldPolicyName: '',
};

class ReportBottom extends React.PureComponent {
    constructor(props) {
        super(props);

        this.onSubmitComment = this.onSubmitComment.bind(this);
    }

    /**
     * @param {String} text
     */
    onSubmitComment(text) {
        Report.addComment(getReportID(this.props.route), text);
    }

    setChatFooterStyles(isOffline) {
        return {...styles.chatFooter, minHeight: !isOffline ? CONST.CHAT_FOOTER_MIN_HEIGHT : 0};
    }

    render() {
        const reportID = getReportID(this.props.route);

        const isArchivedRoom = ReportUtils.isArchivedRoom({chatType: this.props.chatType, stateNum: this.props.stateNum, statusNum: this.props.statusNum});
        return (isArchivedRoom || this.props.session.shouldShowComposeInput) ? (
            <View style={[this.setChatFooterStyles(this.props.network.isOffline), this.props.isComposerFullSize && styles.chatFooterFullCompose]}>
                {
                        isArchivedRoom
                            ? (
                                <ArchivedReportFooter
                                    route={this.props.route}
                                    policyID={this.props.policyID}
                                    ownerEmail={this.props.ownerEmail}
                                    oldPolicyName={this.props.oldPolicyName}
                                />
                            ) : (
                                <SwipeableView onSwipeDown={Keyboard.dismiss}>
                                    <ReportActionCompose
                                        onSubmit={this.onSubmitComment}
                                        reportID={reportID}
                                        participants={this.props.participants}
                                        chatType={this.props.chatType}
                                        isComposerFullSize={this.props.isComposerFullSize}
                                    />
                                </SwipeableView>
                            )
                    }
            </View>
        ) : null;
    }
}

ReportBottom.propTypes = propTypes;
ReportBottom.defaultProps = defaultProps;

export default compose(
    withNetwork(),
    withOnyx({
        session: {
            key: ONYXKEYS.SESSION,
        },
        isComposerFullSize: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT_IS_COMPOSER_FULL_SIZE}${getReportID(route)}`,
        },
    }),
)(ReportBottom);
