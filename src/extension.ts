import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import { parseUsage } from './usageParser';

export function activate(context: vscode.ExtensionContext) {
	const provider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider)
	);

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'claudeUsageTracker.sidebar.focus';
	statusBar.show();
	context.subscriptions.push(statusBar);

	function updateStatusBar() {
		const stats = parseUsage();
		const total = stats.today.messages + stats.today.toolCalls;
		statusBar.text = `$(robot) ${total}`;
		statusBar.tooltip = `Today: ${stats.today.messages} messages · ${stats.today.toolCalls} tool calls · ${stats.today.sessions} sessions`;
	}

	updateStatusBar();
	const timer = setInterval(updateStatusBar, 60_000);
	context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

export function deactivate() {}
