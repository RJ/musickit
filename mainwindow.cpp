#include "mainwindow.h"

#include <QFileDialog>
#include <QMessageBox>
#include <QDesktopServices>
#include <QTime>
#include <QWebFrame>
#include <QGridLayout>
#include <QPushButton>
#include <QInputDialog>

MainWindow::MainWindow(QWidget *parent)
{
    setParent(parent);
    source = 0;
    audioOutput = new Phonon::AudioOutput(Phonon::MusicCategory, this);
    mediaObject = new Phonon::MediaObject(this);
    metaInformationResolver = new Phonon::MediaObject(this);
    mediaObject->setTickInterval(1000);
    connect(mediaObject, SIGNAL(tick(qint64)), this, SLOT(tick(qint64)));
    connect(mediaObject, SIGNAL(stateChanged(Phonon::State, Phonon::State)),
            this, SLOT(stateChanged(Phonon::State, Phonon::State)));
    connect(metaInformationResolver, SIGNAL(stateChanged(Phonon::State,Phonon::State)),
            this, SLOT(metaStateChanged(Phonon::State, Phonon::State)));
    connect(mediaObject, SIGNAL(currentSourceChanged(const Phonon::MediaSource &)),
            this, SLOT(sourceChanged(const Phonon::MediaSource &)));
    connect(mediaObject, SIGNAL(aboutToFinish()), this, SLOT(aboutToFinish()));
    connect(mediaObject, SIGNAL(bufferStatus(int)), this, SLOT(bufferPercent(int)));

    Phonon::createPath(mediaObject, audioOutput);

    setupUi();
    webkitApi = new WebkitApi(this);
    webkitApi->setWebView(webView);

    connect(webkitApi, SIGNAL(pauseToggled()), this, SLOT(togglePause()));
    connect(webkitApi, SIGNAL(volumeChanged(int)), this, SLOT(setVolume(int)));
    connect(webkitApi, SIGNAL(playRequested(QString)), this, SLOT(play(QString)));
    connect(webkitApi, SIGNAL(stopRequested()), this, SLOT(stop()));
    connect(audioOutput, SIGNAL(volumeChanged(qreal)), this, SLOT(volumeChanged(qreal)));

    QString url("./www/index.html");
    webView->load(QUrl(url));
}

MainWindow::~MainWindow()
{
}

void MainWindow::setupUi()
{
    QGridLayout *layout = new QGridLayout();

    webView = new QWebView();
    webView->settings()->setAttribute(QWebSettings::LocalContentCanAccessRemoteUrls,true); // needs QT >= 4.6

    playurlBtn = new QPushButton("Play Stream");
    playfileBtn = new QPushButton("Play Local File");

    layout->addWidget(webView, 0, 0, 1, 2);
    layout->addWidget(playurlBtn, 1, 0);
    layout->addWidget(playfileBtn, 1, 1);

    setLayout(layout);
    show();

    connect(playurlBtn, SIGNAL(clicked()), this, SLOT(on_streambutton_clicked()));
    connect(playfileBtn, SIGNAL(clicked()), this, SLOT(on_playbutton_clicked()));
}

void MainWindow::volumeChanged(qreal vr)
{
    int v = (int) vr*100;
    webkitApi->emitVolumeChanged(v);
}

void MainWindow::setVolume(int v)
{
    if((int)audioOutput->volume() == v) return;
    qDebug() << "Request to set volume to " << v;
    audioOutput->setVolume((qreal)v/100);
}

void MainWindow::togglePause()
{
    switch( mediaObject->state() )
    {
    case Phonon::PausedState:
        mediaObject->play();
        break;

    case Phonon::PlayingState: // fallthrus - states that we are allowed to pause
    case Phonon::LoadingState:
    case Phonon::BufferingState:
        mediaObject->pause();
        break;
    default: ;
    }
}

void MainWindow::play(QString s)
{
    play(QUrl(s));
}

void MainWindow::play(QUrl url)
{
    mediaObject->stop();
    mediaObject->clearQueue();
    if(source) free(source);

    if( (source = new Phonon::MediaSource(url)))
    {
        webkitApi->emitStateChange("loading");
        metaInformationResolver->setCurrentSource(*source);
        mediaObject->setCurrentSource(url);
        mediaObject->play();
    } else {
        log("Error: Failed to create source");
        webkitApi->emitStateChange("fatalerror");
    }
}

void MainWindow::stop()
{
    mediaObject->stop();
}

void MainWindow::bufferPercent(int pc)
{
    // perhaps some logic that decides if we should abort due to slowness?
    webkitApi->emitBufferPercent(pc);
}

void MainWindow::stateChanged(Phonon::State newState, Phonon::State /* oldState */)
 {
     switch (newState) {
         case Phonon::ErrorState:
             if (mediaObject->errorType() == Phonon::FatalError) {
                 webkitApi->emitStateChange("fatalerror");
                 log("StateChanged: Fatal error: " + mediaObject->errorString());
             } else {
                 webkitApi->emitStateChange("error");
                 log("StateChanged: error: " + mediaObject->errorString());
             }
             break;
         case Phonon::PlayingState:
             webkitApi->emitStateChange("playing");
             break;
         case Phonon::StoppedState:
             webkitApi->emitStateChange("stopped");
             break;
         case Phonon::PausedState:
             webkitApi->emitStateChange("paused");
             break;
         case Phonon::BufferingState:
             webkitApi->emitStateChange("buffering");
             break;
         case Phonon::LoadingState:
             webkitApi->emitStateChange("loading");
             break;
        default:
             webkitApi->emitStateChange("unhandledstate");
             ;
     }
 }

void MainWindow::sourceChanged(const Phonon::MediaSource & source)
{
    log("Source changed: " + source.url().toString());
//    musicTable->selectRow(sources.indexOf(source));
//    timeLcd->display("00:00");
}

void MainWindow::metaStateChanged(Phonon::State newState, Phonon::State /* oldState */)
 {
     if (newState == Phonon::ErrorState) {
         log("ERROR opening files: " + metaInformationResolver->errorString());
         //QMessageBox::warning(this, tr("Error opening files"),
         //    metaInformationResolver->errorString());
         return;
     }

     if (newState != Phonon::StoppedState && newState != Phonon::PausedState)
         return;

     if (metaInformationResolver->currentSource().type() == Phonon::MediaSource::Invalid)
             return;
 }


 void MainWindow::tick(qint64 time)
 {

     //QTime displayTime(0, (int)((time / 60000) % 60), (int)((time / 1000) % 60), 0);
     //QString prog = displayTime.toString("mm:ss");
     //setWindowTitle(prog);

     webkitApi->emitTick(time, mediaObject->remainingTime());
     //int secs = time / 1000;
     //jseval(QString("Musickit.tick(%1); null").arg(secs));
 }

 void MainWindow::aboutToFinish()
  {
  }

 void MainWindow::log(QString str)
 {
     QString js("mk_log(\"" + str.replace("\"","\\\"") + "\"); null");
     jseval(js);
 }

 void MainWindow::jseval(QString str)
{     
     qDebug() << str ;
    webView->page()->currentFrame()->evaluateJavaScript(str);
}







void MainWindow::changeEvent(QEvent *e)
{
    /*QMainWindow::changeEvent(e);
    switch (e->type()) {
    case QEvent::LanguageChange:
        //retranslateUi(this);
        break;
    default:
        break;
    }*/
}

void MainWindow::on_playbutton_clicked()
{
    QString file = QFileDialog::getOpenFileName(this, "Select Audio File", QDesktopServices::storageLocation(QDesktopServices::MusicLocation));
    if(!file.isEmpty())
    {
        play( QUrl::fromLocalFile("file://"+file) );
    }
}

void MainWindow::on_streambutton_clicked()
{
    bool ok;
    QString url = QInputDialog::getText(this, "Enter Stream URL", "URL:",
                                        QLineEdit::Normal, "http://www.playdar.org/hiding.mp3", &ok);
    if(ok)
    {
        play(QUrl(url));
    }
}
