#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>

#include <Phonon/AudioOutput>
#include <Phonon/MediaObject>
#include <Phonon/BackendCapabilities>
#include <QString>
#include <QUrl>
#include <QPushButton>
#include <QWebView>
#include <QEvent>

#include "WebkitApi.h"

class Webpage : public QWebPage
{
    virtual void javaScriptConsoleMessage ( const QString & message, int lineNumber, const QString & sourceID )
    {
        qDebug() << message << " @ no. " << lineNumber << " sourceid: " << sourceID;
    }
};

class MainWindow : QWidget {
    Q_OBJECT
public:
    MainWindow(QWidget *parent = 0);
    ~MainWindow();
    friend class WebkitApi;

protected:
    void changeEvent(QEvent *e);

private slots:
    void on_playbutton_clicked();
    void on_streambutton_clicked();
    void on_reloadbutton_clicked();
    void stateChanged(Phonon::State newState, Phonon::State oldState);
    void tick(qint64 time);
    void sourceChanged(const Phonon::MediaSource &source);
    void metaStateChanged(Phonon::State newState, Phonon::State oldState);
    void aboutToFinish();
    void bufferPercent(int);
    void volumeChanged(qreal);

    void togglePause();
    void setVolume(int);
    void play(QString);
    void stop();

private:

    WebkitApi * webkitApi;
    QWebView * webView;
    QPushButton *playurlBtn;
    QPushButton *playfileBtn;
    QPushButton *reloadBtn;

    void setupUi();
    void play(QUrl);

    Phonon::MediaObject *mediaObject;
    Phonon::MediaObject *metaInformationResolver;
    Phonon::AudioOutput *audioOutput;
    Phonon::MediaSource *source;

    void log(QString);
    void jseval(QString);

};

#endif // MAINWINDOW_H
