import {
  aws_autoscaling as autoscaling,
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as elbv2,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  nlb: elbv2.NetworkLoadBalancer;
  nlbTargetGroup: elbv2.NetworkTargetGroup;
  autoScalingGroup: autoscaling.AutoScalingGroup;
}

const PRIMARY_HEADER_HEIGHT: number = 2;
const PRIMARY_HEADER_WIDTH: number = 24;
const SECONDARY_HEADER_HEIGHT: number = 1;
const SECONDARY_HEADER_WIDTH: number = 24;
const GRAPH_WIDGET_HEIGHT: number = 6;
const GRAPH_WIDGET_WIDTH: number = 4;
const ALARM_WIDGET_HEIGHT: number = 1;
const ALARM_WIDGET_WIDTH: number = GRAPH_WIDGET_WIDTH;

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // *********************************************************
    // Network Load Balancer
    // *********************************************************

    // The LoadBalancer dimension value is the suffix of the ARN:
    // e.g. "net/my-nlb/1234567890abcdef"
    const loadBalancerDimensionValue = props.nlb.loadBalancerFullName;
    const networkTargetGroupDimensionValue =
      props.nlbTargetGroup.targetGroupFullName;

    // NLB Reset Count Monitoring

    const nlbTcpTargetResetCountMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "TcpTargetResetCount",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
      },
      label: "NLB TCP Target RST Count",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbTcpClientResetCountMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "TcpTargetClientCount",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
      },
      label: "NLB TCP Client RST Count",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbTcpResetCountMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "TcpElbResetCount",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
      },
      label: "NLB TCP RST Count",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbTcpRstCountHighAlarm = new cloudwatch.Alarm(
      this,
      "nlb-tcp-rst-count-high-alarm",
      {
        metric: nlbTcpResetCountMetric,
        threshold: 50,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "NLB-TCP-RST-Count-High",
      },
    );

    const networkLoadBalancerMainHeader = new cloudwatch.TextWidget({
      height: PRIMARY_HEADER_HEIGHT,
      width: PRIMARY_HEADER_WIDTH,
      markdown: `# Network Load Balancer\n\nMonitoring for NLB ${props.nlb.loadBalancerName}`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    const networkLoadBalancerAlarmHeader = new cloudwatch.TextWidget({
      height: SECONDARY_HEADER_HEIGHT,
      width: SECONDARY_HEADER_WIDTH,
      markdown: `## Alarms`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    const nlbTcpRstCountHighAlarmWidget = new cloudwatch.AlarmWidget({
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      title: "NLB TCP RST Count",
      alarm: nlbTcpRstCountHighAlarm,
    });

    const nlbTcpRstCountGraphWidget = new cloudwatch.GraphWidget({
      title: "NLB TCP Reset Counts",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [
        nlbTcpClientResetCountMetric,
        nlbTcpTargetResetCountMetric,
        nlbTcpResetCountMetric,
      ],
      period: Duration.minutes(1),
    });

    // NLB Port Allocation Error monitoring

    const nlbPortAllocationErrorCountMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "PortAllocationErrorCount",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
      },
      label: "NLB Port Allocation Error Count",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbPortAllocationErrorCountHighAlarm = new cloudwatch.Alarm(
      this,
      "nlb-port-allocation-error-high-alarm",
      {
        metric: nlbPortAllocationErrorCountMetric,
        threshold: 0,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "NLB-Port-Allocation-Err-High",
      },
    );

    const nlbPortAllocationErrorCountHighAlarmWidget =
      new cloudwatch.AlarmWidget({
        width: ALARM_WIDGET_WIDTH,
        height: ALARM_WIDGET_HEIGHT,
        title: "NLB Allocation Error Count",
        alarm: nlbPortAllocationErrorCountHighAlarm,
      });

    const nlbPortAllocationErrorCountGraphWidget = new cloudwatch.GraphWidget({
      title: "NLB Port Allocation Error Count",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [nlbPortAllocationErrorCountMetric],
      period: Duration.minutes(1),
    });

    // NLB Healthy Host Count monitoring

    const nlbHealthyHostCountMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "HealthyHostCount",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
        TargetGroup: networkTargetGroupDimensionValue,
      },
      label: "NLB Healthy Host Count",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbHealthyHostCountLowAlarm = new cloudwatch.Alarm(
      this,
      "nlb-healthy-host-count-low-alarm",
      {
        metric: nlbHealthyHostCountMetric,
        threshold: 1,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "NLB-Healthy-Host-Count-Low",
      },
    );

    const nlbHealthyHostCountLowAlarmWidget = new cloudwatch.AlarmWidget({
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      title: "NLB Healthy Host Count",
      alarm: nlbHealthyHostCountLowAlarm,
    });

    const nlbHealthyHostCountGraphWidget = new cloudwatch.GraphWidget({
      title: "NLB Healthly Host Count",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [nlbHealthyHostCountMetric],
      period: Duration.minutes(1),
    });

    const nlbCoreMetricsHeader = new cloudwatch.TextWidget({
      height: SECONDARY_HEADER_HEIGHT,
      width: SECONDARY_HEADER_WIDTH,
      markdown: `## Core Metrics`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    // NLB Healthy Host Count monitoring

    const nlbUnHealthyHostCountMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "UnHealthyHostCount",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
        TargetGroup: props.nlbTargetGroup.targetGroupFullName,
      },
      label: "NLB UnHealthy Host Count",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbUnHealthyHostCountHighAlarm = new cloudwatch.Alarm(
      this,
      "nlb-unhealthy-host-count-high-alarm",
      {
        metric: nlbUnHealthyHostCountMetric,
        threshold: 2,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "NLB-UnHealthy-Host-Count-Low",
      },
    );

    const nlbUnHealthyHostCountHighAlarmWidget = new cloudwatch.AlarmWidget({
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      title: "NLB UnHealthy Host Count",
      alarm: nlbUnHealthyHostCountHighAlarm,
    });

    const nlbUnHealthyHostCountGraphWidget = new cloudwatch.GraphWidget({
      title: "NLB UnHealthly Host Count",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [nlbUnHealthyHostCountMetric],
      period: Duration.minutes(1),
    });

    // NLB active flow count metrics

    const nlbActiveFlowCountMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "ActiveFlowCount",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
      },
      label: "NLB Active Flow Count",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbActiveFlowCountGraphWidget = new cloudwatch.GraphWidget({
      title: "NLB Active Flow Count",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [nlbActiveFlowCountMetric],
      period: Duration.minutes(1),
    });

    // NLB processed bytes

    const nlbProcessedBytesMetric = new cloudwatch.Metric({
      namespace: "AWS/NetworkELB",
      metricName: "ProcessedBytes",
      statistic: "Sum",
      period: Duration.minutes(1),
      dimensionsMap: {
        LoadBalancer: loadBalancerDimensionValue,
      },
      label: "NLB Processed Bytes",
      unit: cloudwatch.Unit.COUNT,
    });

    const nlbProcessedBytesGraphWidget = new cloudwatch.GraphWidget({
      title: "NLB Processed Bytes",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [nlbProcessedBytesMetric],
      period: Duration.minutes(1),
    });

    // *********************************************************
    // Auto Scaling Group
    // *********************************************************

    // The AWS/AutoScaling group metrics and the custom Service/NginxAutoScalingGroupInstance
    // metrics pushed by the cloudwatch agent are both keyed by the ASG name.
    const asgName = props.autoScalingGroup.autoScalingGroupName;

    const autoScalingGroupMainHeader = new cloudwatch.TextWidget({
      height: PRIMARY_HEADER_HEIGHT,
      width: PRIMARY_HEADER_WIDTH,
      markdown: `# Auto Scaling Group\n\nMonitoring for ASG ${asgName}`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    const autoScalingGroupAlarmHeader = new cloudwatch.TextWidget({
      height: SECONDARY_HEADER_HEIGHT,
      width: SECONDARY_HEADER_WIDTH,
      markdown: `## Alarms`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    // ASG instance state monitoring (AWS/AutoScaling group metrics)

    const asgPendingInstancesMetric = new cloudwatch.Metric({
      namespace: "AWS/AutoScaling",
      metricName: "GroupPendingInstances",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asgName,
      },
      label: "ASG Pending Instances",
      unit: cloudwatch.Unit.COUNT,
    });

    const asgTerminatingInstancesMetric = new cloudwatch.Metric({
      namespace: "AWS/AutoScaling",
      metricName: "GroupTerminatingInstances",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asgName,
      },
      label: "ASG Terminating Instances",
      unit: cloudwatch.Unit.COUNT,
    });

    const asgInServiceInstancesMetric = new cloudwatch.Metric({
      namespace: "AWS/AutoScaling",
      metricName: "GroupInServiceInstances",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asgName,
      },
      label: "ASG In Service Instances",
      unit: cloudwatch.Unit.COUNT,
    });

    // Pending / terminating instances stuck for several minutes indicate a
    // scaling problem; a longer window avoids tripping on normal scaling churn.
    const asgPendingInstancesHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-pending-instances-high-alarm",
      {
        metric: asgPendingInstancesMetric,
        threshold: 0,
        evaluationPeriods: 5,
        datapointsToAlarm: 5,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-Pending-Instances-High",
      },
    );

    const asgTerminatingInstancesHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-terminating-instances-high-alarm",
      {
        metric: asgTerminatingInstancesMetric,
        threshold: 0,
        evaluationPeriods: 5,
        datapointsToAlarm: 5,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-Terminating-Instances-High",
      },
    );

    const asgInServiceInstancesLowAlarm = new cloudwatch.Alarm(
      this,
      "asg-in-service-instances-low-alarm",
      {
        metric: asgInServiceInstancesMetric,
        threshold: 1,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-In-Service-Instances-Low",
      },
    );

    const asgInstanceStateAlarm = new cloudwatch.CompositeAlarm(
      this,
      "asg-instance-state-alarm",
      {
        compositeAlarmName: "ASG-Instance-State",
        alarmRule: cloudwatch.AlarmRule.anyOf(
          asgPendingInstancesHighAlarm,
          asgTerminatingInstancesHighAlarm,
          asgInServiceInstancesLowAlarm,
        ),
      },
    );

    const asgInstanceStateAlarmWidget = new cloudwatch.AlarmStatusWidget({
      // Leave the title undefined to show the alarm widget
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      alarms: [asgInstanceStateAlarm],
    });

    const asgInstanceStateGraphWidget = new cloudwatch.GraphWidget({
      title: "ASG Instance State",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [
        asgPendingInstancesMetric,
        asgTerminatingInstancesMetric,
        asgInServiceInstancesMetric,
      ],
      period: Duration.minutes(1),
    });

    // ASG CPU usage monitoring (custom per-instance metric, averaged across the
    // ASG via a Metrics Insights query. SEARCH is not supported on alarms, and
    // FROM SCHEMA(...) matches only the per-instance dimension set so the
    // agent's [AutoScalingGroupName, InstanceId] rollup is not double-counted.)

    const asgCpuUsageActiveMetric = new cloudwatch.MathExpression({
      expression: `SELECT AVG(cpu_usage_active) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG CPU Usage Active %",
      period: Duration.minutes(1),
    });

    const asgCpuUsageHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-cpu-usage-high-alarm",
      {
        metric: asgCpuUsageActiveMetric,
        threshold: 90,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-CPU-Usage-High",
      },
    );

    const asgCpuUsageHighAlarmWidget = new cloudwatch.AlarmWidget({
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      title: "ASG CPU Usage %",
      alarm: asgCpuUsageHighAlarm,
    });

    const asgCpuUsageGraphWidget = new cloudwatch.GraphWidget({
      title: "ASG CPU Usage Active %",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        max: 100,
        showUnits: true,
      },
      left: [asgCpuUsageActiveMetric],
      period: Duration.minutes(1),
    });

    // ASG memory usage monitoring (custom per-instance metric, averaged across
    // the ASG via a Metrics Insights query)

    const asgMemUsedPercentMetric = new cloudwatch.MathExpression({
      expression: `SELECT AVG(mem_used_percent) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG Memory Usage %",
      period: Duration.minutes(1),
    });

    const asgMemUsageHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-mem-usage-high-alarm",
      {
        metric: asgMemUsedPercentMetric,
        threshold: 90,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-Mem-Usage-High",
      },
    );

    const asgMemUsageHighAlarmWidget = new cloudwatch.AlarmWidget({
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      title: "ASG Memory Usage %",
      alarm: asgMemUsageHighAlarm,
    });

    const asgMemUsageGraphWidget = new cloudwatch.GraphWidget({
      title: "ASG Memory Usage %",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        max: 100,
        showUnits: true,
      },
      left: [asgMemUsedPercentMetric],
      period: Duration.minutes(1),
    });

    // ASG network drops / errors monitoring (custom per-instance metrics,
    // summed across the ASG via Metrics Insights queries)

    const asgNetDropInMetric = new cloudwatch.MathExpression({
      expression: `SELECT SUM(net_drop_in) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG Net Drop In",
      period: Duration.minutes(1),
    });

    const asgNetDropOutMetric = new cloudwatch.MathExpression({
      expression: `SELECT SUM(net_drop_out) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG Net Drop Out",
      period: Duration.minutes(1),
    });

    const asgNetErrInMetric = new cloudwatch.MathExpression({
      expression: `SELECT SUM(net_err_in) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG Net Err In",
      period: Duration.minutes(1),
    });

    const asgNetErrOutMetric = new cloudwatch.MathExpression({
      expression: `SELECT SUM(net_err_out) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG Net Err Out",
      period: Duration.minutes(1),
    });

    // Sustained packet drops / errors on any direction are worth flagging;
    // thresholds are tunable defaults.
    const asgNetDropInHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-net-drop-in-high-alarm",
      {
        metric: asgNetDropInMetric,
        threshold: 0,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-Net-Drop-In-High",
      },
    );

    const asgNetDropOutHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-net-drop-out-high-alarm",
      {
        metric: asgNetDropOutMetric,
        threshold: 0,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-Net-Drop-Out-High",
      },
    );

    const asgNetErrInHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-net-err-in-high-alarm",
      {
        metric: asgNetErrInMetric,
        threshold: 0,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-Net-Err-In-High",
      },
    );

    const asgNetErrOutHighAlarm = new cloudwatch.Alarm(
      this,
      "asg-net-err-out-high-alarm",
      {
        metric: asgNetErrOutMetric,
        threshold: 0,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "ASG-Net-Err-Out-High",
      },
    );

    const asgNetDropErrAlarm = new cloudwatch.CompositeAlarm(
      this,
      "asg-net-drop-err-alarm",
      {
        compositeAlarmName: "ASG-Net-Drop-Err",
        alarmRule: cloudwatch.AlarmRule.anyOf(
          asgNetDropInHighAlarm,
          asgNetDropOutHighAlarm,
          asgNetErrInHighAlarm,
          asgNetErrOutHighAlarm,
        ),
      },
    );

    const asgNetDropErrAlarmWidget = new cloudwatch.AlarmStatusWidget({
      // Leave the title undefined to show the alarm widget
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      alarms: [asgNetDropErrAlarm],
    });

    const asgNetDropErrGraphWidget = new cloudwatch.GraphWidget({
      title: "ASG Net Drops / Errors",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [
        // asgNetDropOutMetric,
        asgNetDropInMetric,
        // asgNetErrOutMetric,
        // asgNetErrInMetric,
      ],
      period: Duration.minutes(1),
    });

    const asgCoreMetricsHeader = new cloudwatch.TextWidget({
      height: SECONDARY_HEADER_HEIGHT,
      width: SECONDARY_HEADER_WIDTH,
      markdown: `## Core Metrics`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    // ASG capacity metrics (AWS/AutoScaling group metrics)

    const asgMaxSizeMetric = new cloudwatch.Metric({
      namespace: "AWS/AutoScaling",
      metricName: "GroupMaxSize",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asgName,
      },
      label: "ASG Max Size",
      unit: cloudwatch.Unit.COUNT,
    });

    const asgMinSizeMetric = new cloudwatch.Metric({
      namespace: "AWS/AutoScaling",
      metricName: "GroupMinSize",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asgName,
      },
      label: "ASG Min Size",
      unit: cloudwatch.Unit.COUNT,
    });

    const asgTotalCapacityMetric = new cloudwatch.Metric({
      namespace: "AWS/AutoScaling",
      metricName: "GroupTotalCapacity",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asgName,
      },
      label: "ASG Total Capacity",
      unit: cloudwatch.Unit.COUNT,
    });

    const asgDesiredCapacityMetric = new cloudwatch.Metric({
      namespace: "AWS/AutoScaling",
      metricName: "GroupDesiredCapacity",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asgName,
      },
      label: "ASG Desired Capacity",
      unit: cloudwatch.Unit.COUNT,
    });

    const asgCapacityGraphWidget = new cloudwatch.GraphWidget({
      title: "ASG Capacity",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [
        asgMaxSizeMetric,
        asgMinSizeMetric,
        asgTotalCapacityMetric,
        asgDesiredCapacityMetric,
      ],
      period: Duration.minutes(1),
    });

    // ASG network bytes throughput (custom per-instance metrics, summed across
    // the ASG via Metrics Insights queries)

    const asgNetBytesSentMetric = new cloudwatch.MathExpression({
      expression: `SELECT SUM(net_bytes_sent) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", InstanceId, AutoScalingGroupName, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG Net Bytes Sent",
      period: Duration.minutes(1),
    });

    const asgNetBytesSentGraphWidget = new cloudwatch.GraphWidget({
      title: "ASG Network Bytes Sent",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [asgNetBytesSentMetric],
      period: Duration.minutes(1),
    });

    const asgNetBytesRecvMetric = new cloudwatch.MathExpression({
      expression: `SELECT SUM(net_bytes_recv) FROM SCHEMA("Service/NginxAutoScalingGroupInstance", InstanceId, AutoScalingGroupName, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "ASG Net Bytes Recv",
      period: Duration.minutes(1),
    });

    const asgNetBytesRecvGraphWidget = new cloudwatch.GraphWidget({
      title: "ASG Network Bytes Recv",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [asgNetBytesRecvMetric],
      period: Duration.minutes(1),
    });

    // *********************************************************
    // Nginx Status
    // *********************************************************

    const nginxStatusMainHeader = new cloudwatch.TextWidget({
      height: PRIMARY_HEADER_HEIGHT,
      width: PRIMARY_HEADER_WIDTH,
      markdown: `# Nginx Status\n\nMonitoring for nginx instances in ASG ${asgName}`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    const nginxStatusAlarmHeader = new cloudwatch.TextWidget({
      height: SECONDARY_HEADER_HEIGHT,
      width: SECONDARY_HEADER_WIDTH,
      markdown: `## Alarms`,
      background: cloudwatch.TextWidgetBackground.TRANSPARENT,
    });

    // Total number of nginx servers reporting up across the ASG (custom nginx
    // status metric, summed across instances via a Metrics Insights query)

    const nginxUpMetric = new cloudwatch.MathExpression({
      expression: `SELECT SUM(nginx_up) FROM SCHEMA("Service/NginxStatus", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "Nginx Servers Up (Total)",
      period: Duration.minutes(1),
    });

    const nginxServersUpLowAlarm = new cloudwatch.Alarm(
      this,
      "nginx-servers-up-low-alarm",
      {
        metric: nginxUpMetric,
        threshold: 0.9,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "Nginx-Servers-Up-Low",
      },
    );

    const nginxServersUpLowAlarmWidget = new cloudwatch.AlarmWidget({
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      title: "Nginx Servers Up",
      alarm: nginxServersUpLowAlarm,
    });

    const nginxServersUpGraphWidget = new cloudwatch.GraphWidget({
      title: "Nginx Servers Up",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [nginxUpMetric],
      period: Duration.minutes(1),
    });

    // Average number of active nginx connections across the ASG (custom nginx
    // status metric, averaged across instances via a Metrics Insights query)

    const nginxConnectionsActiveMetric = new cloudwatch.MathExpression({
      expression: `SELECT AVG(nginx_connections_active) FROM SCHEMA("Service/NginxStatus", AutoScalingGroupName, InstanceId, InstanceType) WHERE AutoScalingGroupName = '${asgName}'`,
      label: "Nginx Active Connections (Avg)",
      period: Duration.minutes(1),
    });

    const nginxActiveConnectionsHighAlarm = new cloudwatch.Alarm(
      this,
      "nginx-active-connections-high-alarm",
      {
        metric: nginxConnectionsActiveMetric,
        threshold: 3000,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: "Nginx-Active-Connections-High",
      },
    );

    const nginxActiveConnectionsHighAlarmWidget = new cloudwatch.AlarmWidget({
      width: ALARM_WIDGET_WIDTH,
      height: ALARM_WIDGET_HEIGHT,
      title: "Nginx Active Connections",
      alarm: nginxActiveConnectionsHighAlarm,
    });

    const nginxActiveConnectionsGraphWidget = new cloudwatch.GraphWidget({
      title: "Nginx Active Connections",
      width: GRAPH_WIDGET_WIDTH,
      height: GRAPH_WIDGET_HEIGHT,
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      legendPosition: cloudwatch.LegendPosition.BOTTOM,
      leftYAxis: {
        min: 0,
        showUnits: true,
      },
      left: [nginxConnectionsActiveMetric],
      period: Duration.minutes(1),
    });

    // *********************************************************
    // Dashboard
    // *********************************************************

    new cloudwatch.Dashboard(this, "service-overview-dashboard", {
      dashboardName: "service-overview",
      defaultInterval: Duration.hours(1),
      widgets: [
        // Network Load Balancer Widgets
        [networkLoadBalancerMainHeader],
        [networkLoadBalancerAlarmHeader],
        [
          nlbTcpRstCountHighAlarmWidget,
          nlbPortAllocationErrorCountHighAlarmWidget,
          nlbHealthyHostCountLowAlarmWidget,
          nlbUnHealthyHostCountHighAlarmWidget,
        ],
        [
          nlbTcpRstCountGraphWidget,
          nlbPortAllocationErrorCountGraphWidget,
          nlbHealthyHostCountGraphWidget,
          nlbUnHealthyHostCountGraphWidget,
        ],
        [nlbCoreMetricsHeader],
        [nlbActiveFlowCountGraphWidget, nlbProcessedBytesGraphWidget],
        [new cloudwatch.Spacer({ height: 2 })],
        // Auto Scaling Group Widgets
        [autoScalingGroupMainHeader],
        [autoScalingGroupAlarmHeader],
        [
          asgInstanceStateAlarmWidget,
          asgCpuUsageHighAlarmWidget,
          asgMemUsageHighAlarmWidget,
          asgNetDropErrAlarmWidget,
        ],
        [
          asgInstanceStateGraphWidget,
          asgCpuUsageGraphWidget,
          asgMemUsageGraphWidget,
          asgNetDropErrGraphWidget,
        ],
        [asgCoreMetricsHeader],
        [
          asgCapacityGraphWidget,
          asgNetBytesSentGraphWidget,
          asgNetBytesRecvGraphWidget,
        ],
        [new cloudwatch.Spacer({ height: 2 })],
        // Nginx Status Widgets
        [nginxStatusMainHeader],
        [nginxStatusAlarmHeader],
        [nginxServersUpLowAlarmWidget, nginxActiveConnectionsHighAlarmWidget],
        [nginxServersUpGraphWidget, nginxActiveConnectionsGraphWidget],
        [new cloudwatch.Spacer({ height: 2 })],
      ],
    });
  }
}

// Changes:
// - Have specific header names and values
// - Put Dashboard into construct
// - Alarm Widget vs Metric Widget vs Text Widget naming
// - Methods to build headers
