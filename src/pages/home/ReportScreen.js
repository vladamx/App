import React from 'react';
import {withOnyx} from 'react-native-onyx';
import PropTypes from 'prop-types';
import {Platform, View} from 'react-native';
import lodashGet from 'lodash/get';
import _ from 'underscore';
import styles from '../../styles/styles';
import ScreenWrapper from '../../components/ScreenWrapper';
import HeaderView from './HeaderView';
import Navigation from '../../libs/Navigation/Navigation';
import ROUTES from '../../ROUTES';
import * as Report from '../../libs/actions/Report';
import ONYXKEYS from '../../ONYXKEYS';
import Permissions from '../../libs/Permissions';
import * as ReportUtils from '../../libs/ReportUtils';
import CONST from '../../CONST';
import toggleReportActionComposeView from '../../libs/toggleReportActionComposeView';
import addViewportResizeListener from '../../libs/VisualViewport';
import ReportActions from './ReportActions';
import ReportBottom from './ReportBottom';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: PropTypes.shape({
        /** Route specific parameters used on this screen */
        params: PropTypes.shape({
            /** The ID of the report this screen should display */
            reportID: PropTypes.string,
        }).isRequired,
    }).isRequired,

    /** Tells us if the sidebar has rendered */
    isSidebarLoaded: PropTypes.bool,

    /** Whether or not to show the Compose Input */
    session: PropTypes.shape({
        shouldShowComposeInput: PropTypes.bool,
    }),

    /** The report currently being looked at */
    report: PropTypes.shape({
        /** ID for the report */
        reportID: PropTypes.number,

        /** Status for the report */
        statusNum: PropTypes.number.isRequired,

        /** Status for the report */
        isLoadingReportActions: PropTypes.bool.isRequired,

        /** State for the report */
        stateNum: PropTypes.number.isRequired,

        /** Chat type for the report */
        chatType: PropTypes.string,

        /** Policy ID for the report */
        policyID: PropTypes.string,

        /** Policy name for the report */
        policyName: PropTypes.string,

        /** Participants for the report */
        participants: PropTypes.arrayOf(PropTypes.string),

        /** Owner email for the report */
        ownerEmail: PropTypes.string,
    }),

    /** Beta features list */
    betas: PropTypes.arrayOf(PropTypes.string),

    /** The policies which the user has access to */
    policies: PropTypes.objectOf(PropTypes.shape({
        /** The policy name */
        name: PropTypes.string,

        /** The type of the policy */
        type: PropTypes.string,
    })),

};

const defaultProps = {
    isSidebarLoaded: false,
    session: {
        shouldShowComposeInput: true,
    },
    report: {
        maxSequenceNumber: 0,
        isLoadingReportActions: false,
    },
    betas: [],
    policies: {},
};

/**
 * Get the currently viewed report ID as number
 *
 * @param {Object} route
 * @param {Object} route.params
 * @param {String} route.params.reportID
 * @returns {String}
 */
function getReportID(route) {
    return route.params.reportID.toString();
}

class ReportScreen extends React.Component {
    constructor(props) {
        super(props);

        this.updateViewportOffsetTop = this.updateViewportOffsetTop.bind(this);
        this.removeViewportResizeListener = () => {};

        this.state = {
            skeletonViewContainerHeight: 0,
            viewportOffsetTop: 0,
        };
    }

    componentDidMount() {
        this.storeCurrentlyViewedReport();
        this.removeViewportResizeListener = addViewportResizeListener(this.updateViewportOffsetTop);
    }

    shouldComponentUpdate(prevProps, nextState) {
        // Its important to be explicit about when ReportScreen re-renders because it is high in the hierarchy
        return prevProps.report.chatType !== this.props.report.chatType
              || prevProps.report.policyID !== this.props.report.policyID
              || prevProps.report.reportID !== this.props.report.reportID
              || prevProps.report.statusNum !== this.props.report.statusNum
              || prevProps.report.stateNum !== this.props.report.stateNum
              || prevProps.isSidebarLoaded !== this.props.isSidebarLoaded
              || prevProps.report.policyName !== this.props.report.policyName
              || prevProps.report.isLoadingReportActions !== this.props.report.isLoadingReportActions
              || prevProps.report.ownerEmail !== this.props.report.ownerEmail
              || prevProps.report.participants.length !== this.props.report.participants.length
              || nextState.skeletonViewContainerHeight !== this.state.skeletonViewContainerHeight
              || nextState.viewportOffsetTop !== this.state.viewportOffsetTop;
    }

    componentDidUpdate(prevProps) {
        if (this.props.route.params.reportID === prevProps.route.params.reportID) {
            return;
        }
        this.storeCurrentlyViewedReport();
    }

    componentWillUnmount() {
        this.removeViewportResizeListener();
    }

    setChatFooterStyles(isOffline) {
        return {...styles.chatFooter, minHeight: !isOffline ? CONST.CHAT_FOOTER_MIN_HEIGHT : 0};
    }

    /**
     * Persists the currently viewed report id
     */
    storeCurrentlyViewedReport() {
        const reportIDFromPath = getReportID(this.props.route);
        if (_.isNaN(reportIDFromPath)) {
            Report.handleInaccessibleReport();
            return;
        }

        // Always reset the state of the composer view when the current reportID changes
        toggleReportActionComposeView(true);
        Report.updateCurrentlyViewedReportID(reportIDFromPath);

        // It possible that we may not have the report object yet in Onyx yet e.g. we navigated to a URL for an accessible report that
        // is not stored locally yet. If props.report.reportID exists, then the report has been stored locally and nothing more needs to be done.
        // If it doesn't exist, then we fetch the report from the API.
        if (this.props.report.reportID) {
            return;
        }

        Report.fetchChatReportsByIDs([reportIDFromPath], true);
    }

    /**
     * @param {SyntheticEvent} e
     */
    updateViewportOffsetTop(e) {
        const viewportOffsetTop = lodashGet(e, 'target.offsetTop', 0);
        this.setState({viewportOffsetTop});
    }

    render() {
        if (!this.props.isSidebarLoaded) {
            return null;
        }

        // We create policy rooms for all policies, however we don't show them unless
        // - It's a free plan workspace
        // - The report includes guides participants (@team.expensify.com) for 1:1 Assigned
        if (!Permissions.canUseDefaultRooms(this.props.betas)
            && ReportUtils.isDefaultRoom(this.props.report)
            && ReportUtils.getPolicyType(this.props.report, this.props.policies) !== CONST.POLICY.TYPE.FREE
            && !ReportUtils.hasExpensifyGuidesEmails(lodashGet(this.props.report, ['participants'], []))
        ) {
            return null;
        }

        if (!Permissions.canUsePolicyRooms(this.props.betas) && ReportUtils.isUserCreatedPolicyRoom(this.props.report)) {
            return null;
        }

        const reportID = getReportID(this.props.route);

        return (
            <ScreenWrapper
                style={[styles.appContent, styles.flex1, {marginTop: this.state.viewportOffsetTop}]}
                keyboardAvoidingViewBehavior={Platform.OS === 'android' ? '' : 'padding'}
            >
                <HeaderView
                    reportID={reportID}
                    onNavigationMenuButtonClicked={() => Navigation.navigate(ROUTES.HOME)}
                />

                <View
                    nativeID={CONST.REPORT.DROP_NATIVE_ID}
                    style={[styles.flex1, styles.justifyContentEnd, styles.overflowHidden]}
                    onLayout={event => this.setState({skeletonViewContainerHeight: event.nativeEvent.layout.height})}
                >
                    <ReportActions
                        route={this.props.route}
                        isLoadingReportActions={this.props.report.isLoadingReportActions}
                        skeletonViewContainerHeight={this.state.skeletonViewContainerHeight}
                    />
                    <ReportBottom
                        chatType={this.props.report.chatType}
                        policyID={this.props.report.policyID}
                        participants={this.props.report.participants}
                        stateNum={this.props.report.stateNum}
                        statusNum={this.props.report.statusNum}
                        ownerEmail={this.props.report.ownerEmail}
                        policyName={this.props.report.policyName}
                        route={this.props.route}
                    />
                </View>
            </ScreenWrapper>
        );
    }
}

ReportScreen.propTypes = propTypes;
ReportScreen.defaultProps = defaultProps;

export default
withOnyx({
    isSidebarLoaded: {
        key: ONYXKEYS.IS_SIDEBAR_LOADED,
    },
    session: {
        key: ONYXKEYS.SESSION,
    },
    report: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT}${getReportID(route)}`,
    },
    betas: {
        key: ONYXKEYS.BETAS,
    },
    policies: {
        key: ONYXKEYS.COLLECTION.POLICY,
    },
})(ReportScreen);
