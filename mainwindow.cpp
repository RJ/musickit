#include "mainwindow.h"

#include <QFileDialog>
#include <QMessageBox>
#include <QDesktopServices>
#include <QTime>
#include <QWebFrame>
#include <QVBoxLayout>
#include <QPushButton>
#include <QInputDialog>
#include <QWebSecurityOrigin>
#include <QMenu>
#include <QMenuItem>

//#include <QNetworkCookieJar>
//#include <QNetworkCookie>


MainWindow::MainWindow()
{

    nam = new QNetworkAccessManager(this);
    pc = new Playdar::Client(nam, this);
    player = new Playengine(this);

    setupUi();

    webkitApi = new WebkitApi(pc, player, this);
    webkitApi->setWebView(webView);
    pc->handshake("localhost", 60210);
/*
    connect(webkitApi, SIGNAL(pauseToggled()), this, SLOT(togglePause()));
    connect(webkitApi, SIGNAL(volumeChanged(int)), this, SLOT(setVolume(int)));
    connect(webkitApi, SIGNAL(playRequested(QString)), this, SLOT(play(QString)));
    connect(webkitApi, SIGNAL(stopRequested()), this, SLOT(stop()));
    connect(audioOutput, SIGNAL(volumeChanged(qreal)), this, SLOT(volumeChanged(qreal)));
*/

    webView->load(QUrl("www/demo/index.html"));

    show();
}

MainWindow::~MainWindow()
{
}

void MainWindow::setupUi()
{
    fileMenu = menuBar()->addMenu("&File");
    QAction * exAct = new QAction("E&xit", this);
    connect(exAct, SIGNAL(triggered()), this, SLOT(close()));

    fileMenu->addAction(exAct);

    QVBoxLayout * layout = new QVBoxLayout;;

    webView = new QWebView();
    webView->setPage(new Webpage);

    webView->settings()->setAttribute(QWebSettings::LocalContentCanAccessRemoteUrls,true); // needs QT >= 4.6
    webView->settings()->globalSettings()->setAttribute(QWebSettings::LocalContentCanAccessRemoteUrls, true);
    webView->settings()->globalSettings()->setAttribute(QWebSettings::DeveloperExtrasEnabled, true);

    layout->addWidget(webView);
    layout->setContentsMargins(QMargins(0,0,0,0));

    QWidget *widget = new QWidget;
    widget->setLayout(layout);
    setCentralWidget(widget);
}

/*
void MainWindow::jseval(QString str)
{     
    // should end in ;null to save memory leaks
     qDebug() << str ;
    webView->page()->currentFrame()->evaluateJavaScript(str);
}
*/
