import React from 'react';
import {withOnyx} from 'react-native-onyx';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ONYXKEYS from '../../ONYXKEYS';
import getReportID from './getReportID';
import ReportActionsView from './report/ReportActionsView';
import ReportActionsSkeletonView from '../../components/ReportActionsSkeletonView';
import reportActionPropTypes from './report/reportActionPropTypes';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: PropTypes.shape({
        /** Route specific parameters used on this screen */
        params: PropTypes.shape({
            /** The ID of the report this screen should display */
            reportID: PropTypes.string,
        }).isRequired,
    }).isRequired,

    /** Flag to check if the report actions data are loading */
    isLoadingReportActions: PropTypes.bool,

    /** Array of report actions for this report */
    reportActions: PropTypes.objectOf(PropTypes.shape(reportActionPropTypes)),

    /** Skeleton container height is passed from context depending on how much space we have */
    skeletonViewContainerHeight: PropTypes.number,

};

const defaultProps = {
    reportActions: {},
    isLoadingReportActions: false,
    skeletonViewContainerHeight: 0,
};

class ReportActions extends React.PureComponent {
    /**
     * When reports change there's a brief time content is not ready to be displayed
     * It Should show the loader if it's the first time we are opening the report
     *
     * @returns {Boolean}
     */
    shouldShowLoader() {
        // This means there are no reportActions at all to display, but it is still in the process of loading the next set of actions.
        const isLoadingInitialReportActions = _.isEmpty(this.props.reportActions) && this.props.isLoadingReportActions;
        return !this.props.route.params.reportID.toString() || isLoadingInitialReportActions || !getReportID(this.props.route);
    }

    render() {
        return (
            this.shouldShowLoader()
                ? (
                    <ReportActionsSkeletonView
                        containerHeight={this.props.skeletonViewContainerHeight}
                    />
                )
                : (
                    <ReportActionsView reportActions={this.props.reportActions} route={this.props.route} />
                )
        );
    }
}

ReportActions.propTypes = propTypes;
ReportActions.defaultProps = defaultProps;

export default withOnyx({
    reportActions: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${getReportID(route)}`,
        canEvict: false,
    },
})(ReportActions);
