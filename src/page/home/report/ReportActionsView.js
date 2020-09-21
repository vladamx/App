import React from 'react';
import {View, ScrollView, Keyboard} from 'react-native';
import PropTypes from 'prop-types';
import _ from 'underscore';
import Text from '../../../components/Text';
import withIon from '../../../components/withIon';
import {fetchActions, updateLastReadActionID} from '../../../lib/actions/Report';
import IONKEYS from '../../../IONKEYS';
import ReportActionItem from './ReportActionItem';
import styles from '../../../style/StyleSheet';
import {withRouter} from '../../../lib/Router';
import ReportActionPropTypes from './ReportActionPropTypes';
import compose from '../../../lib/compose';
import withBatchedRendering from '../../../components/withBatchedRendering';

const propTypes = {
    // The ID of the report actions will be created for
    reportID: PropTypes.number.isRequired,

    /* From withRouter() */
    // eslint-disable-next-line react/forbid-prop-types
    match: PropTypes.object.isRequired,

    /* From withIon() */
    // All of the report actions for this report
    reportActions: PropTypes.PropTypes.objectOf(PropTypes.shape(ReportActionPropTypes)),
};

const defaultProps = {
    reportActions: {},
};

class ReportActionsView extends React.Component {
    constructor(props) {
        super(props);

        this.scrollToListBottom = this.scrollToListBottom.bind(this);
        this.recordMaxAction = this.recordMaxAction.bind(this);
    }

    componentDidMount() {
        this.keyboardEvent = Keyboard.addListener('keyboardDidShow', this.scrollToListBottom);
        fetchActions(this.props.reportID);
    }

    componentWillUnmount() {
        this.keyboardEvent.remove();
    }

    /**
     * Returns true when the report action immediately before the
     * specified index is a comment made by the same actor who who
     * is leaving a comment in the action at the specified index.
     * Also checks to ensure that the comment is not too old to
     * be considered part of the same comment
     *
     * @param {Number} actionIndex - index of the comment item in state to check
     *
     * @return {Boolean}
     */
    // eslint-disable-next-line
    isConsecutiveActionMadeByPreviousActor(actionIndex) {
        // This is the created action and the very first action so it cannot be a consecutive comment.
        if (actionIndex === 0) {
            return false;
        }

        const previousAction = this.props.reportActions[actionIndex - 1];
        const currentAction = this.props.reportActions[actionIndex];

        // It's OK for there to be no previous action, and in that case, false will be returned
        // so that the comment isn't grouped
        if (!currentAction || !previousAction) {
            return false;
        }

        // Only comments that follow other comments are consecutive
        if (previousAction.actionName !== 'ADDCOMMENT' || currentAction.actionName !== 'ADDCOMMENT') {
            return false;
        }

        // Comments are only grouped if they happen within 5 minutes of each other
        if (currentAction.timestamp - previousAction.timestamp > 300) {
            return false;
        }

        return currentAction.actorEmail === previousAction.actorEmail;
    }

    /**
     * When the bottom of the list is reached, this is triggered, so it's a little different than recording the max
     * action when scrolled
     */
    recordMaxAction() {
        const maxVisibleSequenceNumber = _.chain(this.props.reportActions)
            .pluck('sequenceNumber')
            .max()
            .value();

        updateLastReadActionID(this.props.reportID, maxVisibleSequenceNumber);
    }

    /**
     * This function is triggered from the ref callback for the scrollview. That way it can be scrolled once all the
     * items have been rendered. If the number of actions has changed since it was last rendered, then
     * scroll the list to the end.
     */
    scrollToListBottom() {
        if (this.actionListElement) {
            this.actionListElement.scrollToEnd({animated: false});
        }
        this.recordMaxAction();
    }

    render() {
        if (!_.size(this.props.reportActions)) {
            return (
                <View style={[styles.chatContent, styles.chatContentEmpty]}>
                    <Text style={[styles.textP]}>Be the first person to comment!</Text>
                </View>
            );
        }

        return (
            <ScrollView
                ref={(el) => {
                    this.actionListElement = el;
                }}
                onContentSizeChange={this.scrollToListBottom}
                bounces={false}
                contentContainerStyle={[styles.chatContentScrollView]}
            >
                {_.map(this.props.reportActions, (item, index) => (
                    <ReportActionItem
                        key={item.sequenceNumber}
                        action={item}
                        displayAsGroup={this.isConsecutiveActionMadeByPreviousActor(index)}
                    />
                ))}
            </ScrollView>
        );
    }
}

ReportActionsView.propTypes = propTypes;
ReportActionsView.defaultProps = defaultProps;

export default compose(
    withRouter,
    withIon({
        reportActions: {
            key: ({reportID}) => `${IONKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`,
        },
    }),

    // The rendering of report actions happens in batches.
    // The first batch of actions is limited to the 100 most recent actions.
    // The second batch is all of the rest of the actions.
    withBatchedRendering('reportActions', [
        {
            items: (props) => {
                const sortedReportActions = _.sortBy(props.reportActions, 'sequenceNumber');
                return _.chain(sortedReportActions).last(100).indexBy('sequenceNumber').value();
            },
            delay: 0,
        },
        {
            items: (props) => {
                const sortedReportActions = _.sortBy(props.reportActions, 'sequenceNumber');
                return _.indexBy(sortedReportActions, 'sequenceNumber');
            },
            delay: 7000,
        },
    ]),
)(ReportActionsView);
